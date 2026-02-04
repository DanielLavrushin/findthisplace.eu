import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

interface User {
  uid: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start true to check session
  const [error, setError] = useState<string | null>(null);

  // Check existing session on mount (from httpOnly cookies)
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setUser({ uid: data.uid, username: data.username });
          setIsAdmin(data.isAdmin ?? false);
        }
      })
      .catch(() => {
        // Session check failed, user not logged in
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Authenticate with d3.ru
      const d3Response = await fetch("https://d3.ru/middleware/auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          domain_prefix: "",
          forever: "on",
          csrf_token: "",
        }),
      });

      const contentType = d3Response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");

      if (!d3Response.ok) {
        let errorMessage: string;

        if (d3Response.status === 429) {
          errorMessage = "Слишком много попыток. Подождите немного";
        } else if (d3Response.status === 404) {
          errorMessage = "Сервис авторизации недоступен";
        } else if (d3Response.status === 401 || d3Response.status === 403) {
          errorMessage = "Неверный логин или пароль";
        } else if (d3Response.status >= 500) {
          errorMessage = "Ошибка сервера d3.ru. Попробуйте позже";
        } else if (isJson) {
          const errorData = await d3Response.json().catch(() => null);
          errorMessage = errorData?.error || "Ошибка авторизации";
        } else {
          errorMessage = "Ошибка авторизации";
        }

        throw new Error(errorMessage);
      }

      if (!isJson) {
        throw new Error("Неверный ответ сервера");
      }

      const d3Data = await d3Response.json();

      if (!d3Data?.uid || !d3Data?.sid) {
        throw new Error("Не удалось получить данные авторизации");
      }

      // Step 2: Create session on our backend (sets httpOnly cookies)
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          uid: String(d3Data.uid),
          sid: String(d3Data.sid),
          username: d3Data.user?.login || username,
        }),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionData.valid) {
        throw new Error("Не удалось создать сессию");
      }

      setUser({ uid: String(d3Data.uid), username: sessionData.username });
      setIsAdmin(sessionData.isAdmin ?? false);
    } catch (err) {
      let message: string;
      if (err instanceof TypeError && err.message.includes("fetch")) {
        message = "Нет соединения с сервером";
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = "Неизвестная ошибка";
      }
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setIsAdmin(false);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, isLoading, error, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
