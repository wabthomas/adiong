import React from 'react';
import { Link } from 'react-router-dom';
import { IconArrow } from '../components/Icons.jsx';

export default function NotFound() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center">
      <p className="font-display text-8xl font-extrabold text-brand-200">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink-900">Page introuvable</h1>
      <p className="mt-3 max-w-md text-ink-500">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link to="/" className="btn-primary mt-8">
        Retour à l'accueil <IconArrow className="h-4 w-4" />
      </Link>
    </section>
  );
}
