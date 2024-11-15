"use strict";

(function () {
    const CONFIG = {
        // Default settings and constraints
        RETRY_INTERVAL: 2000,
        EXPIRY_INTERVAL: 30000,
        DEFAULT_SIZE: "normal",
        DEFAULT_THEME: "auto",
        DEFAULT_EXECUTION: "render",
        DEFAULT_APPEARANCE: "always",
    };

    const WIDGET_MAP = new Map(); // Stores widget state and configuration
    let scriptConfig = initializeScriptConfig();

    // Core Functions

    /**
     * Initializes the script configuration from the script tag or URL parameters.
     */
    function initializeScriptConfig() {
        const scriptElement = findScriptElement();
        if (!scriptElement) {
            logError("Could not locate Turnstile script tag.", 43777);
            return {};
        }

        const config = {
            loadedAsync: scriptElement.async || scriptElement.defer,
            params: new URLSearchParams(scriptElement.src.split("?")[1] || ""),
        };
        return config;
    }

    /**
     * Renders a widget in the specified container with optional parameters.
     */
    function renderWidget(container, params = {}) {
        const containerElement = resolveContainer(container);
        if (!containerElement) {
            logError(`Invalid container: ${container}`, 3586);
            return;
        }

        const widgetId = generateWidgetId();
        const config = parseWidgetParams(containerElement, params);
        if (!validateWidgetParams(config)) {
            return;
        }

        const iframe = createWidgetIframe(widgetId, config);
        const shadowRoot = containerElement.attachShadow({ mode: "closed" });
        shadowRoot.appendChild(iframe);

        WIDGET_MAP.set(widgetId, { config, iframe, shadowRoot });
    }

    /**
     * Executes the widget's action, such as verifying a response.
     */
    function executeWidget(container, params) {
        const widgetId = resolveWidgetId(container);
        const widgetState = WIDGET_MAP.get(widgetId);

        if (!widgetState) {
            logError(`No widget found for container: ${container}`, 43522);
            return;
        }

        updateWidgetParams(widgetState, params);

        // Trigger execution
        widgetState.iframe.contentWindow.postMessage(
            { event: "execute", widgetId },
            "*"
        );
    }

    /**
     * Resets the widget state for a fresh start.
     */
    function resetWidget(container) {
        const widgetId = resolveWidgetId(container);
        const widgetState = WIDGET_MAP.get(widgetId);

        if (!widgetState) {
            logError(`No widget found to reset for container: ${container}`, 3331);
            return;
        }

        // Clear state and reinitialize
        widgetState.config.response = null;
        const newIframe = createWidgetIframe(widgetId, widgetState.config);
        widgetState.shadowRoot.replaceChild(newIframe, widgetState.iframe);
        widgetState.iframe = newIframe;
    }

    // Helper Functions

    /**
     * Resolves a container element from a selector or HTMLElement.
     */
    function resolveContainer(container) {
        if (typeof container === "string") {
            return document.querySelector(container);
        }
        if (container instanceof HTMLElement) {
            return container;
        }
        return null;
    }

    /**
     * Generates a unique ID for a widget.
     */
    function generateWidgetId() {
        return `widget_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Parses widget parameters from data attributes and input parameters.
     */
    function parseWidgetParams(container, params) {
        const attributes = container.dataset;
        return {
            sitekey: attributes.sitekey || params.sitekey,
            size: attributes.size || CONFIG.DEFAULT_SIZE,
            theme: attributes.theme || CONFIG.DEFAULT_THEME,
            execution: attributes.execution || CONFIG.DEFAULT_EXECUTION,
            appearance: attributes.appearance || CONFIG.DEFAULT_APPEARANCE,
        };
    }

    /**
     * Validates widget parameters.
     */
    function validateWidgetParams(params) {
        if (!params.sitekey) {
            logError("Missing required parameter: sitekey", 3588);
            return false;
        }
        if (!["normal", "compact"].includes(params.size)) {
            logError(`Invalid size: ${params.size}`, 3590);
            return false;
        }
        return true;
    }

    /**
     * Creates an iframe for the widget with the specified configuration.
     */
    function createWidgetIframe(widgetId, config) {
        const iframe = document.createElement("iframe");
        iframe.src = buildWidgetUrl(widgetId, config);
        iframe.style.border = "none";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        return iframe;
    }

    /**
     * Constructs the URL for the widget iframe.
     */
    function buildWidgetUrl(widgetId, config) {
        const baseUrl = "https://challenges.cloudflare.com";
        return `${baseUrl}/cdn-cgi/challenge-platform/turnstile/if/ov2/${widgetId}?size=${config.size}&theme=${config.theme}`;
    }

    /**
     * Logs an error with an optional code.
     */
    function logError(message, code) {
        console.error(`[Turnstile] ${message}`, code ? `(Code: ${code})` : "");
    }

    /**
     * Finds the Turnstile script element in the document.
     */
    function findScriptElement() {
        const scripts = document.querySelectorAll("script[src*='turnstile']");
        return scripts.length ? scripts[0] : null;
    }

    // Public API

    window.turnstile = {
        render: renderWidget,
        execute: executeWidget,
        reset: resetWidget,
    };

    // Initialize

    if (document.readyState === "complete" || document.readyState === "interactive") {
        initializeWidgets();
    } else {
        document.addEventListener("DOMContentLoaded", initializeWidgets);
    }

    /**
     * Automatically initializes widgets on the page based on data attributes.
     */
    function initializeWidgets() {
        const elements = document.querySelectorAll("[data-sitekey]");
        elements.forEach((element) => renderWidget(element));
    }
})();
