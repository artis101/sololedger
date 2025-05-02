import { $, $$ } from "./ui";

// Route definitions
export type Route = {
  path: string;
  tabId: string;
  pageId: string;
  title?: string;
  isLanding?: boolean;
};

// Available routes
export const routes: Route[] = [
  {
    path: "/",
    tabId: "landing-tab",
    pageId: "landing-page",
    title: "Home",
    isLanding: true,
  },
  {
    path: "/app/dashboard",
    tabId: "dashboard-tab",
    pageId: "dashboard-page",
    title: "Dashboard",
  },
  {
    path: "/app/clients",
    tabId: "clients-tab",
    pageId: "clients-page",
    title: "Clients",
  },
  {
    path: "/app/invoices",
    tabId: "invoices-tab",
    pageId: "invoices-page",
    title: "Invoices",
  },
  {
    path: "/app/settings",
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
        this.navigate("/app/invoices");
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

    // Default to home page if no valid route is found
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
    // Get header and navigation elements
    const header = $('#app-header');
    const navigation = $('#app-navigation');
    
    // Handle showing/hiding the app header and navigation for landing pages
    if (route.isLanding) {
      if (header) header.classList.add('hidden');
      if (navigation) navigation.classList.add('hidden');
    } else {
      if (header) header.classList.remove('hidden');
      if (navigation) navigation.classList.remove('hidden');
      
      // Update tab buttons (active state)
      this.tabButtons.forEach((btn) => {
        if (btn.id === route.tabId) {
          btn.classList.add("tab-active");
        } else {
          btn.classList.remove("tab-active");
        }
      });
    }

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
  public navigateToHome(): void {
    this.navigate("/");
  }

  public navigateToDashboard(): void {
    this.navigate("/app/dashboard");
  }

  public navigateToClients(): void {
    this.navigate("/app/clients");
  }

  public navigateToInvoices(): void {
    this.navigate("/app/invoices");
  }

  public navigateToSettings(): void {
    this.navigate("/app/settings");
  }
  
  // Check if a route is an app route (non-landing page)
  public isAppRoute(path: string): boolean {
    return path.startsWith('/app/');
  }
}

// Export a singleton instance
export const router = Router.getInstance;
