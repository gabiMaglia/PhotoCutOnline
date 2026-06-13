import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IconButton from "./IconButton.jsx";

describe("IconButton", () => {
  it("renderiza un <button> con aria-label y dispara onClick", async () => {
    const onClick = jest.fn();
    render(<IconButton label="Acerca de" onClick={onClick}>ⓘ</IconButton>);
    const btn = screen.getByRole("button", { name: "Acerca de" });
    expect(btn).toHaveClass("btn-icon");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza un <a> seguro cuando hay href", () => {
    render(<IconButton label="Donar" href="https://ko-fi.com/x">☕</IconButton>);
    const link = screen.getByRole("link", { name: "Donar" });
    expect(link).toHaveAttribute("href", "https://ko-fi.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
