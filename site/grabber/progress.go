package grabber

import (
	"sync"
	"time"
)

// maxRunErrors is how many of a run's latest errors the admin panel gets.
const maxRunErrors = 20

type RunPhase struct {
	Name       string     `json:"name"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

type RunError struct {
	Time    time.Time `json:"time"`
	PostID  int       `json:"post_id,omitempty"`
	Message string    `json:"message"`
}

// RunState is one grabber run as the admin panel follows it. Phases go
// fetch, save, then the ftp ones: comments, posts, users.
type RunState struct {
	Full       bool       `json:"full"`
	Manual     bool       `json:"manual"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Result     string     `json:"result,omitempty"`
	Error      string     `json:"error,omitempty"`
	Phase      string     `json:"phase"`
	Done       int        `json:"done"`
	Total      int        `json:"total"`
	Current    string     `json:"current,omitempty"`
	Posts      int        `json:"posts"`
	Comments   int        `json:"comments"`
	Phases     []RunPhase `json:"phases"`
	Errors     []RunError `json:"errors"`
	ErrorCount int        `json:"error_count"`
}

// Progress tracks the run in progress, or the last one once it is over.
// version changes with every update, so readers can tell when to look again.
type Progress struct {
	mu      sync.Mutex
	version uint64
	run     *RunState
}

func (p *Progress) start(full, manual bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.run = &RunState{Full: full, Manual: manual, StartedAt: time.Now()}
	p.version++
}

// Phase moves the run to the next phase; total is how many steps it takes,
// 0 when unknown.
func (p *Progress) Phase(name string, total int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	p.endPhase(now)
	p.run.Phases = append(p.run.Phases, RunPhase{Name: name, StartedAt: now})
	p.run.Phase, p.run.Done, p.run.Total, p.run.Current = name, 0, total, ""
	p.version++
}

// Step counts one step of the phase; current names what it works on, if anything.
func (p *Progress) Step(current string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.run.Done++
	p.run.Current = current
	p.version++
}

// Fetched counts a post and its comments brought in from d3.ru.
func (p *Progress) Fetched(comments int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.run.Posts++
	p.run.Comments += comments
	p.version++
}

// Error records a problem with a post that the run carries on past.
func (p *Progress) Error(postID int, message string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.run.ErrorCount++
	p.run.Errors = append(p.run.Errors, RunError{Time: time.Now(), PostID: postID, Message: message})
	if len(p.run.Errors) > maxRunErrors {
		p.run.Errors = p.run.Errors[len(p.run.Errors)-maxRunErrors:]
	}
	p.version++
}

func (p *Progress) finish(err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.run == nil || p.run.FinishedAt != nil {
		return
	}
	now := time.Now()
	p.endPhase(now)
	p.run.FinishedAt = &now
	p.run.Current = ""
	p.run.Result = "success"
	if err != nil {
		p.run.Result = "fail"
		p.run.Error = err.Error()
	}
	p.version++
}

func (p *Progress) endPhase(now time.Time) {
	if n := len(p.run.Phases); n > 0 && p.run.Phases[n-1].FinishedAt == nil {
		p.run.Phases[n-1].FinishedAt = &now
	}
}

// touch marks a change outside the run itself, like a run getting queued.
func (p *Progress) touch() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.version++
}

func (p *Progress) running() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.run != nil && p.run.FinishedAt == nil
}

func (p *Progress) currentVersion() uint64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.version
}

// snapshot copies the run so it can be read while the grabber keeps going.
func (p *Progress) snapshot() *RunState {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.run == nil {
		return nil
	}
	run := *p.run
	run.Phases = append(make([]RunPhase, 0, len(p.run.Phases)), p.run.Phases...)
	run.Errors = append(make([]RunError, 0, len(p.run.Errors)), p.run.Errors...)
	return &run
}
