import React from 'react';
import { Link } from 'react-router-dom';
import { PROBLEMS } from '../constants/problems';

export const ProblemsPage: React.FC = () => (
  <main className="page">
    <h1 className="page-title">Problems</h1>
    <ul className="plain-list">
      {PROBLEMS.map((p) => (
        <li key={p.id}><Link to={`/problems/${p.id}`}>{p.title}</Link></li>
      ))}
    </ul>
  </main>
);

export default ProblemsPage;
