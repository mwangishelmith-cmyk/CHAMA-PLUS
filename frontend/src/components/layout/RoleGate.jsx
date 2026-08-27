import PropTypes from "prop-types";

import { useChama } from "../../context/ChamaContext";
import { ALL_ROLES, roleIn } from "../../lib/roles";

/**
 * Conditionally renders UI for the allowed roles (buttons, menu items, cards),
 * based on the CURRENT chama membership role.
 * Use it *inside* an already protected page — it hides controls, it does not
 * protect data.
 */
export function RoleGate({ roles, children, fallback = null }) {
  const { role } = useChama();
  return roleIn(role, roles) ? children : fallback;
}

RoleGate.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.oneOf(ALL_ROLES)).isRequired,
  children: PropTypes.node,
  fallback: PropTypes.node,
};

export default RoleGate;
