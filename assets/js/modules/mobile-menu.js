export function initMobileMenu() {
  const mobileMenuButton = document.getElementById("mobileMenuButton");
  const closeMobileMenu = document.getElementById("closeMobileMenu");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileLinks = document.querySelectorAll(".mobile-nav a, .mobile-menu-cta");

  function openMobileMenu() {
    if (!mobileMenu || !mobileMenuOverlay) return;

    mobileMenu.classList.add("open");
    mobileMenuOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    if (!mobileMenu || !mobileMenuOverlay) return;

    mobileMenu.classList.remove("open");
    mobileMenuOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", openMobileMenu);
  }

  if (closeMobileMenu) {
    closeMobileMenu.addEventListener("click", closeMenu);
  }

  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener("click", closeMenu);
  }

  mobileLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  return { closeMenu };
}
