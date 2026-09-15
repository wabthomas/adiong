import React from 'react';
import { PageTitle } from './AdminUI.jsx';
import MediaLibrary from '../../components/MediaLibrary.jsx';

export default function MediaAdmin() {
  return (
    <div>
      <PageTitle
        title="Médiathèque"
        subtitle="Images et documents PDF — import, recherche, copie d'URL, insertion dans les articles"
      />
      <MediaLibrary embedded />
    </div>
  );
}
