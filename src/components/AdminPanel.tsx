import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, logout } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, Trash2, LogOut } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  role: string;
  displayName: string;
  highestScore: number;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const privateRef = doc(db, 'users_private', user.uid);
        const privateSnap = await getDoc(privateRef);
        
        if ((privateSnap.exists() && privateSnap.data().role === 'admin') || user.email === 'lekimlam16052015@gmail.com') {
          setIsAdmin(true);
          fetchUsers();
        } else {
          alert('Access Denied. You are not an admin.');
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking admin status', error);
        navigate('/');
      }
    };

    checkAdminAndFetch();
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      const privateDocs = await getDocs(collection(db, 'users_private'));
      const publicDocs = await getDocs(collection(db, 'users_public'));

      const publicDataMap = new Map();
      publicDocs.forEach(doc => publicDataMap.set(doc.id, doc.data()));

      const combinedUsers: UserData[] = [];
      privateDocs.forEach(doc => {
        const priv = doc.data();
        const pub = publicDataMap.get(doc.id) || {};
        combinedUsers.push({
          uid: priv.uid,
          email: priv.email,
          role: priv.role,
          displayName: pub.displayName || 'Unknown',
          highestScore: pub.highestScore || 0
        });
      });

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error fetching users', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteDoc(doc(db, 'users_private', uid));
      await deleteDoc(doc(db, 'users_public', uid));
      setUsers(users.filter(u => u.uid !== uid));
    } catch (error) {
      console.error('Error deleting user', error);
      alert('Failed to delete user.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading Admin Panel...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Shield className="text-emerald-500" size={32} />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('/')} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors">
              Back to Game
            </button>
            <button onClick={async () => { await logout(); navigate('/login'); }} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users size={20} /> Registered Players
            </h2>
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
              Total: {users.length}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Player</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Highest Score</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {users.map(user => (
                  <tr key={user.uid} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{user.displayName}</td>
                    <td className="px-6 py-4 text-gray-400">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-emerald-400">{user.highestScore}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(user.uid)}
                        disabled={user.role === 'admin'}
                        className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                        title={user.role === 'admin' ? "Cannot delete admin" : "Delete user"}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
