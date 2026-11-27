"use client";

import { useRouter } from "next/navigation";

// A select that goes to a page when you choose, so a long list of options sits
// behind one control instead of spread across the screen. Each option carries
// the address to go to, which keeps filter state in the URL where it can be
// shared.
export function LinkSelect({
  label, value, options, className = "selectbox",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
  className?: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label={label}
      className={className}
      value={value}
      onChange={(e) => {
        const o = options.find((x) => x.value === e.target.value);
        if (o) router.push(o.href);
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
