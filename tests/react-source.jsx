import React from "react";
import { createRoot } from "react-dom/client";
function ControlledForm() {
  const [name, setName] = React.useState("");
  const [count, setCount] = React.useState(0);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <label>
        Full name
        <input
          id="react-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <output id="react-value">{name}</output>
      <button id="react-render" onClick={() => setCount((n) => n + 1)}>
        Rerender {count}
      </button>
    </form>
  );
}
createRoot(document.getElementById("react-root")).render(<ControlledForm />);
