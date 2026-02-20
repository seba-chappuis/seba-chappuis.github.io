(function () {
    'use strict';
    
    // Email is obfuscated to prevent bots to scrape it from here
    const emailSecret = [
        893, 888, 835, 897, 894, 886, 898, 905,
        900, 893, 853, 904, 894, 906, 901, 901,
        886, 893, 888, 835, 886, 887, 890, 904,
    ];
    const emailAnchor = document.getElementById('contact-email');
    
    const preventDefault = ev => {
        ev.preventDefault();
    };
    
    emailAnchor.addEventListener('click', preventDefault);
    
    let isRevealed = false;
    
    function revealEmail() {
        if (isRevealed) return;
        isRevealed = true;
        const email = emailSecret
            .map(e => e - 789)
            .map(e => String.fromCharCode(e))
            .reverse()
            .join('');
        emailAnchor.href = 'mailto:' + email;
        emailAnchor.removeEventListener('click', preventDefault);
    }
    
    // Reveal the email after a short delay
    // to prevent bots to "click" on it too early
    setTimeout(revealEmail, 500);
})();
