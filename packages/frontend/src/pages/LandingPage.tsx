import React from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => (
  <main className="page page-center">
    <h1 className="page-hero">Judge code at the speed of thought.</h1>
    <p className="page-sub">Sandboxed multi-language evaluation with live per-test streaming.</p>
    <div className="page-actions">
      <Link to="/problems" className="btn btn-secondary" id="landing-explore">Explore problems</Link>
      <Link to="/problems/two-sum" className="btn btn-secondary" id="landing-sandbox">Open sandbox</Link>
    </div>
  </main>
);

export default LandingPage;
