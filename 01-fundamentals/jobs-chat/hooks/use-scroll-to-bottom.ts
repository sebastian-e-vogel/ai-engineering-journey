import { useEffect, useRef, type DependencyList } from "react";

export function useScrollToBottom<T extends HTMLElement>(deps: DependencyList) {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, deps);

  return ref;
}
