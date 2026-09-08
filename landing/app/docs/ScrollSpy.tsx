"use client";

import { useEffect } from "react";

/** Surligne l'entrée de sommaire correspondant à la section visible. */
export function ScrollSpy() {
  useEffect(() => {
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".docs-toc-group a")
    );
    const sections = links
      .map((a) => document.querySelector(a.getAttribute("href") ?? ""))
      .filter((el): el is Element => el !== null);

    function onScroll() {
      let current = sections[0];
      const scrollPos = window.scrollY + 120;
      for (const sec of sections) {
        if ((sec as HTMLElement).offsetTop <= scrollPos) current = sec;
      }
      links.forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === `#${current?.id}`);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
