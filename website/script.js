
/* ============================================
   FAQ TOGGLE JAVASCRIPT
   ============================================ */

function toggleFaq(element) {
    const item = element.closest('.faq-item');
    const isActive = item.classList.contains('active');
    
    // Close all other FAQ items
    document.querySelectorAll('.faq-item').forEach(el => {
        if (el !== item) {
            el.classList.remove('active');
        }
    });
    
    // Toggle current item
    if (isActive) {
        item.classList.remove('active');
    } else {
        item.classList.add('active');
    }
}