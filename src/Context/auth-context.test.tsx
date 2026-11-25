import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/session";
import { AuthProvider, useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), login: vi.fn(), logout: vi.fn(), register: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  ...mocks,
}));

function Harness() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="user">{auth.user?.display_name ?? "none"}</span>
      <button type="button" onClick={() => void auth.login("owner@example.com", "password")}>Login</button>
      <button type="button" onClick={() => auth.logout()}>Logout</button>
      <button type="button" onClick={() => void auth.register("Invitee", "invitee@example.com", "password")}>Register</button>
    </div>
  );
}

const owner = { id: "owner", email: "owner@example.com", display_name: "Owner" };

afterEach(() => {
  clearAccessToken();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("restores a valid stored session", async () => {
    setAccessToken("stored-token");
    mocks.getCurrentUser.mockResolvedValue(owner);
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("Owner");
  });

  it("treats an invalid stored token as signed out", async () => {
    setAccessToken("expired-token");
    mocks.getCurrentUser.mockRejectedValue(new Error("Session expired"));
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("updates context for login, registration, logout, and Axios token clearing", async () => {
    mocks.login.mockResolvedValue(owner);
    mocks.register.mockResolvedValue({ ...owner, display_name: "Invitee" });
    mocks.logout.mockImplementation(() => clearAccessToken());
    render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await screen.findByText("Owner");
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(screen.getByTestId("user")).toHaveTextContent("none");

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await screen.findByText("Invitee");
    await act(async () => clearAccessToken());
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(getAccessToken()).toBeNull();
  });
});
