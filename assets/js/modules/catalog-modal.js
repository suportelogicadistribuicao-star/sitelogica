export function initCatalogModal() {
  const catalogModal = document.getElementById("catalogModal");
  const catalogModalImage = document.getElementById("catalogModalImage");
  const catalogModalClose = document.getElementById("catalogModalClose");

  function closeCatalogModal() {
    if (!catalogModal || !catalogModalImage) return;

    catalogModal.classList.remove("open");
    catalogModalImage.src = "";
    document.body.style.overflow = "";
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".catalog-page-button");

    if (!button || !catalogModal || !catalogModalImage) return;

    const carousel = button.closest(".catalog-carousel");

    if (carousel && carousel.dataset.swiped === "true") {
      return;
    }

    const image = button.dataset.image;
    const title = button.dataset.title;

    catalogModalImage.src = image;
    catalogModalImage.alt = title;
    catalogModal.classList.add("open");
    document.body.style.overflow = "hidden";
  });

  if (catalogModalClose) {
    catalogModalClose.addEventListener("click", closeCatalogModal);
  }

  if (catalogModal) {
    catalogModal.addEventListener("click", (event) => {
      if (event.target === catalogModal) {
        closeCatalogModal();
      }
    });
  }

  return { closeCatalogModal };
}
