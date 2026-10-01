import { useEffect, useState } from "react";

// Matches the layout breakpoint in shell.css: below 768 px one pane is shown at a time.
const query = "(max-width: 767px)";

export function useNarrow() {
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setNarrow(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, []);
  return narrow;
}
