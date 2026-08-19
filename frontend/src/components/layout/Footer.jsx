/** App footer. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <p>&copy; {new Date().getFullYear()} ChamaLedger. All rights reserved.</p>
        <p className="flex items-center gap-4">
          <a href="/" className="transition-colors hover:text-foreground">
            Privacy
          </a>
          <a href="/" className="transition-colors hover:text-foreground">
            Terms
          </a>
          <a href="/" className="transition-colors hover:text-foreground">
            Support
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
