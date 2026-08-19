import PropTypes from "prop-types";
import { ShieldCheck } from "lucide-react";

import ThemeToggle from "../layout/ThemeToggle";
import Card, { CardBody } from "../common/Card";

/** Split-screen shell shared by the login and register pages. */
export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel — hidden on small screens */}
      <aside className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          ChamaLedger
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Group savings, transparent to the last shilling.
          </h2>
          <p className="mt-4 text-sm opacity-90">
            Track contributions, loans and member balances in one shared ledger your whole chama
            can trust.
          </p>
        </div>
        <p className="text-xs opacity-75">Secure JWT sessions · Role-based access</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center lg:text-left">
              <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <Card>
              <CardBody className="p-6 sm:p-7">{children}</CardBody>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

AuthLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
};

export default AuthLayout;
