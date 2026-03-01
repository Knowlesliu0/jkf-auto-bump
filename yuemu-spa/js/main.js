document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Scroll Effect
    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 2. Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navBtn = document.querySelector('.nav-btn');

    // Create a mobile container if it doesn't exist to wrap links and button
    if (window.innerWidth <= 768) {
        setupMobileMenu();
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && !document.querySelector('.mobile-nav-active')) {
            setupMobileMenu();
        } else if (window.innerWidth > 768) {
            resetMobileMenu();
        }
    });

    function setupMobileMenu() {
        navLinks.style.display = 'none';
        navBtn.style.display = 'none';

        menuToggle.addEventListener('click', toggleMenu);
    }

    function resetMobileMenu() {
        navLinks.style.display = 'flex';
        navBtn.style.display = 'inline-flex';
        navLinks.classList.remove('mobile-nav-active');
        menuToggle.removeEventListener('click', toggleMenu);
    }

    function toggleMenu() {
        if (navLinks.style.display === 'none') {
            navLinks.style.display = 'flex';
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '100%';
            navLinks.style.left = '0';
            navLinks.style.width = '100%';
            navLinks.style.background = 'rgba(255, 255, 255, 0.95)';
            navLinks.style.padding = '1rem 2rem';
            navLinks.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
            navLinks.classList.add('mobile-nav-active');

            navBtn.style.display = 'inline-flex';
            navBtn.style.margin = '1rem auto';
            navLinks.appendChild(navBtn);
        } else {
            navLinks.style.display = 'none';
            navLinks.classList.remove('mobile-nav-active');
        }
    }

    // Close mobile menu on click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                navLinks.style.display = 'none';
                navLinks.classList.remove('mobile-nav-active');
            }
        });
    });

    // 3. Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Optional: Stop observing once revealed
                // observer.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        threshold: 0.15, // Trigger when 15% visible
        rootMargin: "0px 0px -50px 0px"
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // trigger once on load for elements already in view (like hero content is handled by CSS animation, but just in case)
    setTimeout(() => {
        revealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
                el.classList.add('active');
            }
        });
    }, 100);


    // 4. Tab Switching for Price List
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.menu-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            // Add active to clicked button
            btn.classList.add('active');

            // Hide all content
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
            });

            // Show target content
            const targetId = btn.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);

            // Note: because we swapped the HTML structure to make 'single' the default active one,
            // we just need to fade it in
            targetContent.style.display = 'block';
            setTimeout(() => {
                targetContent.classList.add('active');
            }, 50);
        });
    });
});
