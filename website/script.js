/* ============================================
   FAQ TOGGLE JAVASCRIPT
   ============================================ */

function toggleFaq(element) {
  const item = element.closest(".faq-item");
  const isActive = item.classList.contains("active");

  // Close all other FAQ items
  document.querySelectorAll(".faq-item").forEach((el) => {
    if (el !== item) {
      el.classList.remove("active");
    }
  });

  // Toggle current item
  if (isActive) {
    item.classList.remove("active");
  } else {
    item.classList.add("active");
  }
}

/* ============================================
   DARK MODE TOGGLE
   ============================================ */

const themeToggle = document.getElementById("themeToggle");
const themeIcon = themeToggle.querySelector(".theme-icon");

// Check saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  themeIcon.textContent = "☀️";
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");

  if (document.body.classList.contains("dark-mode")) {
    localStorage.setItem("theme", "dark");
    themeIcon.textContent = "☀️";
  } else {
    localStorage.setItem("theme", "light");
    themeIcon.textContent = "🌙";
  }
});
