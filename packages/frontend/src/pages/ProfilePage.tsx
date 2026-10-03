import React from 'react';
import { useParams } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  return (
    <main className="page">
      <h1 className="page-title">{username}</h1>
      <p className="page-sub">Developer profile</p>
    </main>
  );
};

export default ProfilePage;
