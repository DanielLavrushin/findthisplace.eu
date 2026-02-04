import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import PostCard from "./PostCard";
import { useNotFoundPosts } from "./useNotFoundPosts";
import { plural } from "../../utils/plural";
import tire0marker from "../../../assets/tire0marker.png";
import tire1marker from "../../../assets/tire1marker.png";
import tire2marker from "../../../assets/tire2marker.png";
import tire3marker from "../../../assets/tire3marker.png";
import tire4marker from "../../../assets/tire4marker.png";
import "./NotFoundFilter.css";

const tierMarkers = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];

const tierLabels = ["Новая", "Бронза", "Серебро", "Золото", "Эпическая"];

export default function NotFoundList() {
  const { data: posts, isLoading, error } = useNotFoundPosts();

  // Filter state
  const [selectedTiers, setSelectedTiers] = useState<Set<number>>(new Set());
  const [authorQuery, setAuthorQuery] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get unique authors from posts
  const authors = useMemo(() => {
    if (!posts) return [];
    const uniqueAuthors = [...new Set(posts.map((p) => p.username))];
    return uniqueAuthors.sort((a, b) => a.localeCompare(b));
  }, [posts]);

  // Filter authors by query
  const filteredAuthors = useMemo(() => {
    if (!authorQuery.trim()) return authors;
    const query = authorQuery.toLowerCase();
    return authors.filter((a) => a.toLowerCase().includes(query));
  }, [authors, authorQuery]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((post) => {
      const tierMatch =
        selectedTiers.size === 0 || selectedTiers.has(post.tier);
      const authorMatch = !selectedAuthor || post.username === selectedAuthor;
      return tierMatch && authorMatch;
    });
  }, [posts, selectedTiers, selectedAuthor]);

  const toggleTier = (tier: number) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  const selectAuthor = (author: string) => {
    setSelectedAuthor(author);
    setAuthorQuery(author);
    setDropdownOpen(false);
  };

  const clearAuthor = () => {
    setSelectedAuthor(null);
    setAuthorQuery("");
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setSelectedTiers(new Set());
    setSelectedAuthor(null);
    setAuthorQuery("");
  };

  const hasFilters = selectedTiers.size > 0 || selectedAuthor;
  const activeFilterCount =
    selectedTiers.size + (selectedAuthor ? 1 : 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!dropdownOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setDropdownOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) =>
            Math.min(i + 1, filteredAuthors.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredAuthors[highlightedIndex]) {
            selectAuthor(filteredAuthors[highlightedIndex]);
          }
          break;
        case "Escape":
          setDropdownOpen(false);
          break;
      }
    },
    [dropdownOpen, filteredAuthors, highlightedIndex]
  );

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredAuthors]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ py: 4 }}>
        Не удалось загрузить загадки
      </Typography>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4 }}>
        Нет ненайденных загадок
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        У нас тут {plural(posts.length, "загадка")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        и мы пока не знаем, где это
      </Typography>

      {/* Filter bar */}
      <div className="not-found-filter">
        <div className="not-found-filter__bar">
          {/* Tier filter */}
          <div className="not-found-filter__section">
            <span className="not-found-filter__label">Уровень:</span>
            <div className="not-found-filter__tiers">
              {tierMarkers.map((marker, tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`not-found-filter__tier${
                    selectedTiers.has(tier)
                      ? " not-found-filter__tier--active"
                      : ""
                  }`}
                  data-tier={tier}
                  onClick={() => toggleTier(tier)}
                  title={tierLabels[tier]}
                >
                  <img
                    className="not-found-filter__tier-icon"
                    src={marker}
                    alt={tierLabels[tier]}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="not-found-filter__divider" />

          {/* Author filter */}
          <div className="not-found-filter__section">
            <span className="not-found-filter__label">Автор:</span>
            <div className="not-found-filter__author-wrap">
              <input
                ref={inputRef}
                type="text"
                className="not-found-filter__author-input"
                placeholder="Поиск автора..."
                value={authorQuery}
                onChange={(e) => {
                  setAuthorQuery(e.target.value);
                  setSelectedAuthor(null);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className={`not-found-filter__author-clear${
                  authorQuery ? " not-found-filter__author-clear--visible" : ""
                }`}
                onClick={clearAuthor}
                tabIndex={-1}
              >
                ✕
              </button>
              {dropdownOpen && (
                <div ref={dropdownRef} className="not-found-filter__dropdown">
                  {filteredAuthors.length > 0 ? (
                    filteredAuthors.map((author, index) => (
                      <div
                        key={author}
                        className={`not-found-filter__dropdown-item${
                          selectedAuthor === author
                            ? " not-found-filter__dropdown-item--selected"
                            : ""
                        }${
                          index === highlightedIndex
                            ? " not-found-filter__dropdown-item--highlighted"
                            : ""
                        }`}
                        onClick={() => selectAuthor(author)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        {author}
                      </div>
                    ))
                  ) : (
                    <div className="not-found-filter__dropdown-empty">
                      Автор не найден
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clear all button */}
          <button
            type="button"
            className="not-found-filter__clear-all"
            onClick={clearAll}
            disabled={!hasFilters}
          >
            Сбросить
            {activeFilterCount > 0 && (
              <span className="not-found-filter__count">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Results count when filtered */}
      {hasFilters && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, fontStyle: "italic" }}
        >
          Показано: {plural(filteredPosts.length, "загадка")} из {posts.length}
        </Typography>
      )}

      {/* Posts grid */}
      <div className="not-found-filter__grid" key={`${[...selectedTiers].join("-")}-${selectedAuthor ?? ""}`}>
        {filteredPosts.map((post, index) => (
          <div
            key={post.id}
            className="not-found-filter__card-wrapper"
            style={{ animationDelay: `${Math.min(index * 0.03, 0.5)}s` }}
          >
            <PostCard post={post} />
          </div>
        ))}
      </div>

      {/* Empty state when filters exclude everything */}
      {hasFilters && filteredPosts.length === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            color: "text.secondary",
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Ничего не найдено
          </Typography>
          <Typography variant="body2">
            Попробуйте изменить фильтры
          </Typography>
        </Box>
      )}
    </Box>
  );
}
