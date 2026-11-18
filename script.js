/* Luxe Furniture storefront interactions. This script uses only elements in index.html. */
(() => {
  "use strict";

  const initializeStore = () => {
    if (document.documentElement.dataset.luxeStoreReady === "true") return;
    document.documentElement.dataset.luxeStoreReady = "true";

    const menuToggle = document.querySelector(".menu-toggle");
    const navigation = document.querySelector("#primary-navigation");
    const searchForm = document.querySelector(".search-form");
    const searchInput = document.querySelector("#product-search");
    const cartButton = document.querySelector(".cart-button");
    const cartCount = document.querySelector(".cart-count");
    const wishlistButton = document.querySelector(".wishlist-button");
    const wishlistCount = document.querySelector(".wishlist-count");
    const productGrid = document.querySelector(".product-grid");
    const products = [...document.querySelectorAll(".product-card")].map((card) => {
      const title = card.querySelector(".product-info h3")?.textContent.trim() || "Furniture item";
      const id = card.dataset.productId || card.querySelector("[data-add-to-cart]")?.dataset.addToCart || title;
      const parsedPrice = Number(card.dataset.price || card.querySelector(".current-price")?.textContent.replace(/[^\d.]/g, ""));
      return {
        id,
        title,
        category: card.dataset.category || "",
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        description: card.querySelector(".product-description")?.textContent.trim() || "",
        image: card.querySelector(".product-image")?.currentSrc || card.querySelector(".product-image")?.src || "",
        card
      };
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    const storageKeys = { cart: "luxeFurniture.cart.v1", wishlist: "luxeFurniture.wishlist.v1" };
    const readStorage = (key, fallback) => {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch (error) {
        console.warn(`Could not read ${key} from localStorage.`, error);
        return fallback;
      }
    };
    const writeStorage = (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Could not save ${key} to localStorage.`, error);
      }
    };

    const rawCart = readStorage(storageKeys.cart, {});
    const cart = new Map();
    if (rawCart && typeof rawCart === "object" && !Array.isArray(rawCart)) {
      Object.entries(rawCart).forEach(([id, value]) => {
        const product = productById.get(id);
        const quantity = Number(value?.quantity);
        if (product && Number.isInteger(quantity) && quantity > 0) {
          cart.set(id, { ...product, quantity });
        }
      });
    }
    const rawWishlist = readStorage(storageKeys.wishlist, []);
    const wishlist = new Set(Array.isArray(rawWishlist) ? rawWishlist.filter((id) => productById.has(id)) : []);
    let activeCategory = "all";
    let searchTerm = "";
    const originalShopDescription = document.querySelector("#shop .section-heading > p:last-child")?.textContent || "";
    const shopStatus = document.querySelector("#shop .section-heading > p:last-child");
    shopStatus?.setAttribute("aria-live", "polite");

    const setMenuOpen = (isOpen) => {
      if (!menuToggle) return;
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    };
    menuToggle?.addEventListener("click", () => {
      setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
    });
    navigation?.addEventListener("click", (event) => {
      if (event.target.closest("a[href^='#']")) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    });
    window.matchMedia("(min-width: 768px)").addEventListener?.("change", () => setMenuOpen(false));

    const persistCart = () => {
      const serialized = Object.fromEntries([...cart.entries()].map(([id, item]) => [id, { quantity: item.quantity }]));
      writeStorage(storageKeys.cart, serialized);
    };
    const renderCartCount = () => {
      const count = [...cart.values()].reduce((total, item) => total + item.quantity, 0);
      if (cartCount) cartCount.textContent = String(count);
      cartButton?.setAttribute("aria-label", `Shopping cart, ${count} ${count === 1 ? "item" : "items"}`);
    };
    const persistWishlist = () => writeStorage(storageKeys.wishlist, [...wishlist]);
    const renderWishlist = () => {
      if (wishlistCount) wishlistCount.textContent = String(wishlist.size);
      wishlistButton?.setAttribute("aria-label", `View wishlist, ${wishlist.size} ${wishlist.size === 1 ? "item" : "items"}`);
      document.querySelectorAll("[data-wishlist]").forEach((button) => {
        const id = button.dataset.wishlist;
        const isSaved = wishlist.has(id);
        button.setAttribute("aria-pressed", String(isSaved));
        button.setAttribute("aria-label", `${isSaved ? "Remove" : "Add"} ${productById.get(id)?.title || "product"} ${isSaved ? "from" : "to"} wishlist`);
      });
    };

    // Cart controls are limited to the markup provided: add buttons and the header cart button.
    productGrid?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-to-cart]");
      if (!button) return;
      const product = productById.get(button.dataset.addToCart);
      if (!product) return;
      const existing = cart.get(product.id);
      cart.set(product.id, { ...product, quantity: (existing?.quantity || 0) + 1 });
      persistCart();
      renderCartCount();
      window.alert(`${product.title} has been added to your cart.`);
    });
    cartButton?.addEventListener("click", () => {
      if (!cart.size) {
        window.alert("Your cart is empty. Explore the collection to find a piece you love.");
        return;
      }
      const lines = [...cart.values()].map((item, index) => `${index + 1}. ${item.title} — ${money.format(item.price)} × ${item.quantity}`);
      const total = [...cart.values()].reduce((sum, item) => sum + item.price * item.quantity, 0);
      const instruction = "\n\nTo change a quantity, enter the line number and new quantity as: line,quantity (example: 1,2). Enter quantity 0 to remove that item. Cancel to close.";
      const answer = window.prompt(`Your cart\n\n${lines.join("\n")}\n\nTotal: ${money.format(total)}${instruction}`, "");
      if (answer === null || !answer.trim()) return;
      const match = answer.trim().match(/^(\d+)\s*,\s*(\d+)$/);
      if (!match) {
        window.alert("Use the format line,quantity (for example, 1,2). Your cart has not changed.");
        return;
      }
      const lineNumber = Number(match[1]);
      const quantity = Number(match[2]);
      const item = [...cart.values()][lineNumber - 1];
      if (!item || !Number.isSafeInteger(quantity)) {
        window.alert("That cart line or quantity is not valid. Your cart has not changed.");
        return;
      }
      if (quantity === 0) cart.delete(item.id);
      else cart.set(item.id, { ...item, quantity });
      persistCart();
      renderCartCount();
      window.alert(quantity === 0 ? `${item.title} was removed from your cart.` : `Cart updated. ${item.title} quantity: ${quantity}.`);
    });

    // Wishlist toggles and header summary use existing buttons; no panel exists in the page.
    productGrid?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-wishlist]");
      if (!button) return;
      const product = productById.get(button.dataset.wishlist);
      if (!product) return;
      if (wishlist.has(product.id)) {
        wishlist.delete(product.id);
        window.alert(`${product.title} was removed from your wishlist.`);
      } else {
        wishlist.add(product.id);
        window.alert(`${product.title} was added to your wishlist.`);
      }
      persistWishlist();
      renderWishlist();
    });
    wishlistButton?.addEventListener("click", () => {
      if (!wishlist.size) {
        window.alert("Your wishlist is empty. Save a piece by selecting its heart icon.");
        return;
      }
      const savedItems = [...wishlist].map((id) => productById.get(id)?.title).filter(Boolean);
      window.alert(`Your wishlist\n\n${savedItems.map((title) => `• ${title}`).join("\n")}`);
    });
    renderCartCount();
    renderWishlist();

    // Search filters product names and keeps the current category selection in effect.
    const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
    const updateProducts = () => {
      const query = normalize(searchTerm);
      const visibleProducts = products.filter((product) => {
        const matchesSearch = !query || normalize(product.title).includes(query);
        const matchesCategory = activeCategory === "all" || product.category === activeCategory;
        return matchesSearch && matchesCategory;
      });
      const visibleIds = new Set(visibleProducts.map((product) => product.id));
      products.forEach((product) => { product.card.hidden = !visibleIds.has(product.id); });
      if (shopStatus) {
        if (!visibleProducts.length) {
          shopStatus.textContent = "No furniture found. Try another search or category.";
        } else if (query || activeCategory !== "all") {
          shopStatus.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "piece" : "pieces"} found.`;
        } else {
          shopStatus.textContent = originalShopDescription;
        }
      }
      document.querySelectorAll(".category-card[data-category]").forEach((card) => {
        const selected = card.dataset.category === activeCategory;
        card.setAttribute("aria-pressed", String(selected));
        card.classList.toggle("is-active", selected);
      });
    };
    searchInput?.addEventListener("input", () => {
      searchTerm = searchInput.value;
      updateProducts();
    });
    searchForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      searchTerm = searchInput?.value || "";
      updateProducts();
      document.querySelector("#shop")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    document.querySelector(".category-grid")?.addEventListener("click", (event) => {
      const categoryCard = event.target.closest("[data-category]");
      if (!categoryCard) return;
      event.preventDefault();
      const requestedCategory = categoryCard.dataset.category;
      activeCategory = activeCategory === requestedCategory ? "all" : requestedCategory;
      updateProducts();
      document.querySelector("#shop")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    updateProducts();

    // Newsletter validation and local confirmation only; no email is transmitted or stored.
    const newsletterForm = document.querySelector(".newsletter-form");
    newsletterForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = newsletterForm.querySelector("input[type='email']");
      if (!email) return;
      if (!email.checkValidity()) {
        email.reportValidity();
        return;
      }
      const note = newsletterForm.parentElement?.querySelector(".newsletter-note");
      if (note) {
        note.textContent = "Thank you for subscribing! This demo does not send or save email addresses.";
        note.setAttribute("role", "status");
        note.setAttribute("aria-live", "polite");
      }
      newsletterForm.reset();
    });

    // Native smooth scrolling is declared in the stylesheet; this also handles missing hash targets safely.
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='#']");
      if (!link || link.closest(".category-grid")) return;
      const hash = link.getAttribute("href");
      const target = hash && document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      if (hash !== "#") history.replaceState(null, "", hash);
    });

    // Animate existing sections as they enter view without adding elements or changing the stylesheet.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && "IntersectionObserver" in window && Element.prototype.animate) {
      const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.animate(
            [{ opacity: 0.55, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }],
            { duration: 480, easing: "ease-out", fill: "both" }
          );
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
      document.querySelectorAll(".section-heading, .category-card, .product-card, .about-content, .about-image-wrap, .offer-banner, .benefit-card, .testimonial-card, .newsletter-inner, .contact-item").forEach((element) => observer.observe(element));
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeStore, { once: true });
  } else {
    initializeStore();
  }
})();
