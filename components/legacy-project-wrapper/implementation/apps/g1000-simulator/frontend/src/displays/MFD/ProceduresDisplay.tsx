import { Link } from "react-router-dom";

export const ProceduresDisplay = () => (
  <div className="mfd__panel">
    <h4 className="mfd__panel-title">Procedures</h4>
    <p>
      Browse current sourced FAA records, cycle verification and incomplete
      guidance details.
    </p>
    <Link to="/procedures">Open FAA procedure browser</Link>
  </div>
);
