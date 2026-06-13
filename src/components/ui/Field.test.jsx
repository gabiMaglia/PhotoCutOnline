import { render, screen } from "@testing-library/react";
import Field from "./Field.jsx";

describe("Field", () => {
  it("asocia la etiqueta con el control hijo vía htmlFor/id", () => {
    render(
      <Field id="app-name" label="Nombre">
        <input id="app-name" />
      </Field>
    );
    // si el for/id casan, getByLabelText encuentra el input
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });
});
