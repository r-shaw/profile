document.addEventListener('DOMContentLoaded', function() {
    const themeButton = document.getElementById('theme-button');
    themeButton.addEventListener('click', function() {
      document.body.classList.toggle('dark-theme');
    });
  });