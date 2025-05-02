import { $, $$ } from "./ui";

// Route definitions
export type Route = {
  path: string;
  tabId: string;
  pageId: string;
  title?: string;
};

// Available routes
export const routes: Route[] = [
  {
    path: "/",
    tabId: "dashboard-tab",
    pageId: "dashboard-page",
    title: "Dashboard",
  },
  {
    path: "/clients",
    tabId: "clients-tab",
    pageId: "clients-page",
    title: "Clients",
  },
  {
    path: "/invoices",
    tabId: "invoices-tab",
    pageId: "invoices-page",
    title: "Invoices",
  },
  {
    path: "/settings",
    tabId: "settings-tab",
    pageId: "settings-page",
    title: "Settings",
  },
];

// Current route
let currentRoute: Route | null = null;

// Router class to handle SPA navigation
export class Router {
  private static instance: Router;
  private tabButtons: NodeListOf<Element>;
  private tabContents: NodeListOf<Element>;
  private routes: Route[];

  private constructor() {
    this.tabButtons = $$(".tab-button");
    this.tabContents = $$(".tab-content");
    this.routes = routes;

    // Initialize the router
    this.setupEventListeners();
    this.handleInitialRoute();
  }

  // Singleton pattern
  public static getInstance(): Router {
    if (!Router.instance) {
      Router.instance = new Router();
    }
    return Router.instance;
  }

  // Set up event listeners for navigation
  private setupEventListeners(): void {
    // Listen for tab button clicks
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", (e: Event) => {
        e.preventDefault();
        const tabId = (button as HTMLElement).id;

        // Find the route for this tab
        const route = this.routes.find((r) => r.tabId === tabId);
        if (route) {
          this.navigate(route.path);
        }
      });
    });

    // Listen for popstate events (browser back/forward)
    window.addEventListener("popstate", (event) => {
      if (event.state && event.state.path) {
        this.handleRouteChange(event.state.path, false);
      } else {
        this.handleRouteChange(window.location.pathname, false);
      }
    });

    // View All Invoices link
    const viewAllInvoicesLink = $("#view-all-invoices");
    if (viewAllInvoicesLink) {
      viewAllInvoicesLink.addEventListener("click", (e: Event) => {
        e.preventDefault();
        this.navigate("/invoices");
      });
    }
  }

  // Handle the initial route on page load
  private handleInitialRoute(): void {
    // Get the current path from the URL
    let currentPath = window.location.pathname;

    // If there's a hash-based route (for compatibility), use it
    if (window.location.hash && window.location.hash.startsWith("#/")) {
      currentPath = window.location.hash.substring(1);
    }

    // Default to dashboard if no valid route is found
    const validPath = this.routes.some((route) => route.path === currentPath);
    if (!validPath) {
      currentPath = "/";
    }

    // Apply the route without pushing to history (we're already here)
    this.handleRouteChange(currentPath, false);
  }

  // Navigate to a specific route
  public navigate(path: string): void {
    this.handleRouteChange(path, true);
  }

  // Handle changing to a new route
  private handleRouteChange(path: string, updateHistory: boolean): void {
    // Find the matching route
    const route = this.routes.find((r) => r.path === path);
    if (!route) {
      // Fallback to home if route not found
      this.handleRouteChange("/", updateHistory);
      return;
    }

    // Update the browser history if needed
    if (updateHistory) {
      window.history.pushState({ path }, route.title || "", path);
    }

    // Update the document title
    if (route.title) {
      document.title = `SoloLedger - ${route.title}`;
    }

    // Update the UI
    this.updateUI(route);

    // Save the current route
    currentRoute = route;
  }

  // Update UI based on the current route
  private updateUI(route: Route): void {
    // Update tab buttons (active state)
    this.tabButtons.forEach((btn) => {
      if (btn.id === route.tabId) {
        btn.classList.add("tab-active");
      } else {
        btn.classList.remove("tab-active");
      }
    });

    // Show the correct content page, hide others
    this.tabContents.forEach((content) => {
      if ((content as HTMLElement).id === route.pageId) {
        content.classList.remove("hidden");
      } else {
        content.classList.add("hidden");
      }
    });
  }

  // Get the current route
  public getCurrentRoute(): Route | null {
    return currentRoute;
  }

  // Navigate to a specific page (helper methods)
  public navigateToDashboard(): void {
    this.navigate("/");
  }

  public navigateToClients(): void {
    this.navigate("/clients");
  }

  public navigateToInvoices(): void {
    this.navigate("/invoices");
  }

  public navigateToSettings(): void {
    this.navigate("/settings");
  }
}

// Export a singleton instance
export const router = Router.getInstance;
