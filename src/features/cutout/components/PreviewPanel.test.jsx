import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import PreviewPanel from "./PreviewPanel.jsx";

function setup(props = {}) {
  const base = {
    panelRef: createRef(),
    size: { w: 220, h: 240 },
    pos: null,
    bg: "checker",
    setBg: jest.fn(),
    color: "#ffffff",
    setColor: jest.fn(),
    exportMode: "transparent",
    bgColor: "#ffffff",
    bgImage: null,
    bgOpacity: 100,
    resultUrl: "cut.png",
    onClose: jest.fn(),
    handlers: {
      dragDown: jest.fn(),
      dragMove: jest.fn(),
      dragUp: jest.fn(),
      cutDown: jest.fn(),
      cutMove: jest.fn(),
      cutUp: jest.fn(),
      cutCancel: jest.fn(),
      resizeDown: jest.fn(),
      resizeMove: jest.fn(),
      resizeUp: jest.fn(),
    },
  };
  const result = render(<PreviewPanel {...base} {...props} />);
  return { ...base, ...props, ...result };
}

describe("PreviewPanel", () => {
  it("muestra el conmutador de fondo solo en modo transparente", () => {
    const { rerender } = render(
      <PreviewPanelWrapper exportMode="transparent" />
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    rerender(<PreviewPanelWrapper exportMode="solid" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("cierra con el botón ×", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: /cerrar|close|fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renderiza el recorte arrastrable", () => {
    const { container } = setup();
    expect(container.querySelector("img.preview-cutout")).toHaveAttribute("src", "cut.png");
  });
});

// helper para re-render con distinto exportMode manteniendo el resto
function PreviewPanelWrapper({ exportMode }) {
  const handlers = {
    dragDown: () => {}, dragMove: () => {}, dragUp: () => {},
    cutDown: () => {}, cutMove: () => {}, cutUp: () => {}, cutCancel: () => {},
    resizeDown: () => {}, resizeMove: () => {}, resizeUp: () => {},
  };
  return (
    <PreviewPanel
      panelRef={createRef()}
      size={{ w: 220, h: 240 }}
      pos={null}
      bg="checker"
      setBg={() => {}}
      color="#fff"
      setColor={() => {}}
      exportMode={exportMode}
      bgColor="#fff"
      bgImage={null}
      bgOpacity={100}
      resultUrl="cut.png"
      onClose={() => {}}
      handlers={handlers}
    />
  );
}
