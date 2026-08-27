import PropTypes from "prop-types";

import Select from "../common/Select";
import { useChama } from "../../context/ChamaContext";
import { roleLabel } from "../../lib/roles";

/**
 * "Select chama" dropdown. Rendered whenever the user belongs to more than one
 * chama so the active context is always visible and changeable.
 */
export function ChamaSwitcher({ label = "Select chama", className }) {
  const { memberships, chamaId, selectChama } = useChama();

  if (memberships.length <= 1) return null;

  return (
    <div className={className}>
      <Select
        label={label}
        value={chamaId || ""}
        onChange={(e) => selectChama(e.target.value)}
      >
        <option value="" disabled>
          Select chama…
        </option>
        {memberships.map((m) => (
          <option key={m.chama_id} value={m.chama_id}>
            {m.chama_name || m.chama_id} — {roleLabel(m.role)}
          </option>
        ))}
      </Select>
    </div>
  );
}

ChamaSwitcher.propTypes = { label: PropTypes.string, className: PropTypes.string };

export default ChamaSwitcher;
