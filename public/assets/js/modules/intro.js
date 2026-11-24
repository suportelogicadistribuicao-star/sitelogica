export function initIntro() {
  const body = document.body;
  const intro = document.getElementById("intro");

  body.classList.add("intro-active");

  let siteEntered = false;

  const triggerEvents = ["mousemove", "mousedown", "click", "touchstart", "wheel", "keydown"];

  function removeEnterListeners() {
    triggerEvents.forEach((eventName) => {
      window.removeEventListener(eventName, enterSite);
    });
  }

  function enterSite() {
    if (siteEntered) return;

    siteEntered = true;
    removeEnterListeners();

    body.classList.add("entered");
    body.classList.remove("intro-active");

    setTimeout(() => {
      if (intro) {
        intro.style.display = "none";
      }
    }, 1500);
  }

  triggerEvents.forEach((eventName) => {
    window.addEventListener(eventName, enterSite, { passive: true });
  });

  setTimeout(enterSite, 2600);
}
