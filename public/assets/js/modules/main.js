import { catalogs } from "./catalog-data.js";
import { initCatalogSection } from "./catalog.js";
import { initCatalogModal } from "./catalog-modal.js";
import { initIntro } from "./intro.js";
import { initMobileMenu } from "./mobile-menu.js";

export function initApp() {
  initIntro();
  initCatalogSection(catalogs);

  const { closeMenu } = initMobileMenu() || {};
  const { closeCatalogModal } = initCatalogModal() || {};
  const catalogSection = document.getElementById("catalogo");
  const catalogMenuLinks = document.querySelectorAll('a[href="#catalogo"]');

  function openCatalogSectionFromMenu(event) {
    if (!catalogSection) return;

    event.preventDefault();
    catalogSection.classList.remove("is-hidden");
    catalogSection.scrollIntoView({ behavior: "smooth" });

    if (typeof closeMenu === "function") {
      closeMenu();
    }
  }

  catalogMenuLinks.forEach((link) => {
    link.addEventListener("click", openCatalogSectionFromMenu);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (typeof closeCatalogModal === "function") {
        closeCatalogModal();
      }

      if (typeof closeMenu === "function") {
        closeMenu();
      }
    }
  });
}
