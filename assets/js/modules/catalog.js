function setupCatalogCarousel(carousel) {
  if (!carousel) return;

  const track = carousel.querySelector(".catalog-track");
  const slides = carousel.querySelectorAll(".catalog-slide");
  const prevButton = carousel.querySelector(".catalog-arrow.prev");
  const nextButton = carousel.querySelector(".catalog-arrow.next");
  const currentText = carousel.querySelector(".catalog-current");

  if (!track || slides.length === 0) return;

  let current = 0;
  let startX = 0;
  let currentX = 0;
  let isTouching = false;

  function updateCarousel() {
    track.style.transform = `translateX(-${current * 100}%)`;

    if (currentText) {
      currentText.textContent = String(current + 1);
    }
  }

  function goNext() {
    current = (current + 1) % slides.length;
    updateCarousel();
  }

  function goPrev() {
    current = (current - 1 + slides.length) % slides.length;
    updateCarousel();
  }

  if (nextButton) {
    nextButton.addEventListener("click", goNext);
  }

  if (prevButton) {
    prevButton.addEventListener("click", goPrev);
  }

  carousel.addEventListener(
    "touchstart",
    (event) => {
      startX = event.touches[0].clientX;
      currentX = startX;
      isTouching = true;
    },
    { passive: true }
  );

  carousel.addEventListener(
    "touchmove",
    (event) => {
      if (!isTouching) return;
      currentX = event.touches[0].clientX;
    },
    { passive: true }
  );

  carousel.addEventListener("touchend", () => {
    if (!isTouching) return;

    const diff = startX - currentX;

    if (Math.abs(diff) > 45) {
      carousel.dataset.swiped = "true";

      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }

      setTimeout(() => {
        carousel.dataset.swiped = "false";
      }, 350);
    }

    isTouching = false;
  });

  updateCarousel();
}

function showEmptyCatalog(elements, brand) {
  const { catalogTitle, catalogText, productGrid, catalogCount } = elements;

  if (!catalogTitle || !catalogText || !productGrid) return;

  catalogTitle.textContent = brand;
  catalogText.textContent =
    "Catálogo em preparação. Em breve esta indústria terá suas páginas disponíveis para consulta.";

  if (catalogCount) {
    catalogCount.textContent = "Em breve";
  }

  productGrid.innerHTML = `
    <article class="catalog-empty-state">
      <span>${brand}</span>
      <h3>Catálogo em preparação</h3>
      <p>
        Esta indústria já faz parte da vitrine da Lógica Distribuição.
        As páginas do catálogo serão adicionadas em breve.
      </p>
    </article>
  `;
}

function showCatalog(elements, brand, brandData) {
  const { catalogTitle, catalogText, productGrid, catalogCount } = elements;

  if (!catalogTitle || !catalogText || !productGrid) return;

  catalogTitle.textContent = brand;
  catalogText.textContent = brandData.description;
  productGrid.innerHTML = "";

  if (!brandData.pages || brandData.pages.length === 0) {
    showEmptyCatalog(elements, brand);
    return;
  }

  if (catalogCount) {
    catalogCount.textContent = `${brandData.pages.length} páginas`;
  }

  const slides = brandData.pages
    .map((page, index) => {
      const imagePath = `assets/images/catalogos/${page}`;

      return `
        <div class="catalog-slide">
          <article class="catalog-page-card">
            <button class="catalog-page-button" data-image="${imagePath}" data-title="${brand} - Página ${index + 1}">
              <img src="${imagePath}" alt="${brand} página ${index + 1}">
            </button>

            <div class="catalog-page-info">
              <span>${brand}</span>
              <strong>Página ${index + 1}</strong>
            </div>
          </article>
        </div>
      `;
    })
    .join("");

  productGrid.innerHTML = `
    <div class="catalog-carousel" data-current="0" data-swiped="false">
      <button class="catalog-arrow prev" type="button" aria-label="Página anterior">‹</button>

      <div class="catalog-viewport">
        <div class="catalog-track">
          ${slides}
        </div>
      </div>

      <button class="catalog-arrow next" type="button" aria-label="Próxima página">›</button>

      <div class="catalog-counter">
        <span class="catalog-current">1</span> de ${brandData.pages.length}
      </div>

      <div class="catalog-swipe-hint">arraste para o lado para passar as páginas</div>
    </div>
  `;

  const carousel = productGrid.querySelector(".catalog-carousel");
  setupCatalogCarousel(carousel);
}

export function initCatalogSection(catalogs) {
  const elements = {
    catalogTitle: document.getElementById("catalogTitle"),
    catalogText: document.getElementById("catalogText"),
    productGrid: document.getElementById("productGrid"),
    catalogCount: document.getElementById("catalogCount")
  };

  const industryCards = document.querySelectorAll(".industry-card");

  industryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const brand = card.dataset.brand;
      const brandData = catalogs[brand];
      const catalogSection = document.getElementById("catalogo");

      industryCards.forEach((item) => {
        item.classList.remove("active");
      });

      card.classList.add("active");

      if (brandData) {
        showCatalog(elements, brand, brandData);
      } else {
        showEmptyCatalog(elements, brand);
      }

      if (catalogSection) {
        catalogSection.classList.remove("is-hidden");

        setTimeout(() => {
          catalogSection.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    });
  });
}
