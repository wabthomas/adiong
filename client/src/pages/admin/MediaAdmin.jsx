import React from 'react';
import { PageTitle } from './AdminUI.jsx';
import MediaLibrary from '../../components/MediaLibrary.jsx';

export default function MediaAdmin() {
  return (
    <div>
      <PageTitle
        title="Médiathèque"
        subtitle="Toutes les images du site — upload, recherche, copie d'URL, suppression (optimisées automatiquement)"
      />
      <MediaLibrary embedded />
    </div>
  );
}
