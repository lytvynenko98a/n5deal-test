"use client";

import { useState } from "react";

/**
 * Multi-select rendered as toggle chips with hidden inputs, so the value posts
 * with a plain form submit and the page keeps working without client JS beyond
 * the toggle itself.
 */
export function ChipMultiSelect({
  name,
  options,
  initial,
  columns = false,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  initial: string[];
  columns?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initial);

  const toggle = (value: string) =>
    setSelected((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );

  return (
    <div className={columns ? "flex max-h-52 flex-wrap gap-1.5 overflow-y-auto thin-scroll" : "flex flex-wrap gap-1.5"}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            aria-pressed={active}
            className={`chip ${active ? "chip-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </div>
  );
}
