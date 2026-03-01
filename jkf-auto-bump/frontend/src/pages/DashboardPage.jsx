import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogOut, Plus, Trash2, Play, AlertCircle, CheckCircle2, Clock, HelpCircle, Cookie, Edit3, Timer } from 'lucide-react';

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ url: '', cookieString: '', intervalMinutes: 60, jkfUsername: '', jkfPassword: '' });
  const [showCookieHelp, setShowCookieHelp] = useState(false);
  const [editCookieTask, setEditCookieTask] = useState(null);
  const [editCookieValue, setEditCookieValue] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchApi = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const res = await fetch(`http://localhost:3001${url}`, { ...options, headers });
    return res;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const tasksRes = await fetchApi('/api/tasks');
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      } catch (err) {
        console.error('Failed to load dashboard data');
      }
    };
    loadData();

    // Poll for task updates
    const interval = setInterval(() => {
      fetchApi('/api/tasks')
        .then(res => res.json())
        .then(data => setTasks(data))
        .catch(() => { });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      if (tasks.some(t => t.url === newTask.url)) {
        alert('這個文章已經在推文排程中囉！');
        return;
      }

      const res = await fetchApi('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name: '擷取標題中...',
          url: newTask.url,
          cookieString: newTask.cookieString,
          intervalMinutes: newTask.intervalMinutes,
          jkfUsername: newTask.jkfUsername,
          jkfPassword: newTask.jkfPassword
        })
      });

      if (res.ok) {
        const createdTask = await res.json();
        setTasks([createdTask, ...tasks]);
        setShowAddModal(false);
        setNewTask({ url: '', cookieString: '', intervalMinutes: 60, jkfUsername: '', jkfPassword: '' });
        alert('任務新增成功！');
      } else {
        alert('新增任務失敗');
      }
    } catch (err) {
      alert('系統操作失敗，請檢查網路狀態');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('確定要刪除此任務嗎？')) return;
    try {
      const res = await fetchApi(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== id));
      } else {
        alert('刪除失敗，請重新整理網頁後重試！');
      }
    } catch (err) {
      alert('刪除失敗');
    }
  };

  const handleTriggerTask = async (id) => {
    try {
      // Optimistically set to running
      setTasks(tasks.map(t => t.id === id ? { ...t, status: 'running' } : t));
      await fetchApi(`/api/tasks/${id}/trigger`, { method: 'POST' });
    } catch (err) {
      alert('手動觸發失敗');
    }
  };

  const handleUpdateCookie = async (e) => {
    e.preventDefault();
    if (!editCookieTask) return;
    try {
      const res = await fetchApi(`/api/tasks/${editCookieTask.id}/cookie`, {
        method: 'PATCH',
        body: JSON.stringify({
          cookieString: editCookieValue || undefined,
          jkfUsername: editUsername,
          jkfPassword: editPassword
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === updated.id ? updated : t));
        setEditCookieTask(null);
        setEditCookieValue('');
        setEditUsername('');
        setEditPassword('');
        alert('更新成功！');
      } else {
        alert('更新失敗');
      }
    } catch (err) {
      alert('操作失敗');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/10 glass sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-red-500 w-6 h-6" />
            <span className="font-bold tracking-wider">黑閃行銷 - 個人版</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header & Add Button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">自動推文任務管理</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 新增任務
          </button>
        </div>

        {/* Tasks Table */}
        {tasks.length === 0 ? (
          <div className="text-center py-20 glass rounded-xl border border-white/5 border-dashed">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-1">尚無任何自動推文任務</h3>
            <p className="text-gray-500 text-sm">點擊上方按鈕新增您的第一個 JKF 自動推文任務</p>
          </div>
        ) : (
          <div className="glass rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-300 w-1/2">文章標題</th>
                    <th className="px-6 py-4 font-medium text-gray-300">狀態與頻率</th>
                    <th className="px-6 py-4 font-medium text-gray-300">時間資訊</th>
                    <th className="px-6 py-4 font-medium text-gray-300 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-white/5 transition-colors group relative">
                      <td className="px-6 py-4 whitespace-normal">
                        <div className="font-bold text-base mb-1 text-white leading-tight">
                          {task.name === '擷取標題中...' ? <span className="text-gray-500 italic">{task.name}</span> : task.name}
                        </div>
                        <a href={task.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                          查看文章連結
                        </a>
                        {task.last_message && task.status === 'failed' && (
                          <div className="text-xs text-red-400 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> <span className="line-clamp-1">{task.last_message}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium border flex-shrink-0 ${task.status === 'running' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                            task.status === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                              task.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}>
                            {task.status === 'running' && '執行中'}
                            {task.status === 'success' && '已成功'}
                            {task.status === 'failed' && '失敗'}
                            {task.status === 'idle' && '待命'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 每 {task.interval_minutes} 分鐘
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        <div className="space-y-1">
                          <div>
                            <span className="text-gray-500 text-xs">下次執行:</span><br /> {new Date(task.next_run).toLocaleString()}
                          </div>
                          {task.top_expires_at && (() => {
                            // Try to parse "YYYY-MM-DD HH:MM:SS" reliably
                            const dateStr = task.top_expires_at.replace(' ', 'T');
                            const expiresAt = new Date(dateStr);

                            let isExpiringSoon = false;
                            if (!isNaN(expiresAt.getTime())) {
                              const diffHours = (expiresAt - new Date()) / (1000 * 60 * 60);
                              isExpiringSoon = diffHours <= 48;
                            }

                            return (
                              <div className="mt-2 inline-flex items-center bg-[#2d2d2d] rounded px-3 py-1.5 border border-white/5 shadow-sm">
                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/40 ${isExpiringSoon ? 'text-red-400' : 'text-amber-400'} mr-2`}>
                                  一般置頂
                                </span>
                                <span className="text-sm font-medium text-white tracking-wide">
                                  時間到 : {task.top_expires_at}
                                </span>
                              </div>
                            );
                          })()}
                          {(() => {
                            let isFree = false;
                            let countdownDisplay = "00:00";
                            let progressPercent = 0;

                            if (task.last_run && task.status !== 'failed') {
                              const lastRunTime = new Date(task.last_run).getTime();
                              const expiresTime = lastRunTime + (60 * 60 * 1000);
                              const diffMs = expiresTime - currentTime.getTime();

                              if (diffMs > 0) {
                                isFree = true;
                                const m = Math.floor(diffMs / 60000);
                                const s = Math.floor((diffMs % 60000) / 1000);
                                countdownDisplay = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                progressPercent = (diffMs / (60 * 60 * 1000)) * 100;
                              }
                            } else if (task.free_status && task.free_status.includes('現在有空')) {
                              isFree = true;
                              countdownDisplay = "未知";
                              progressPercent = 100;
                            }

                            return (
                              <div className="mt-3 w-full bg-black/20 rounded-lg p-2.5 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-gray-400 text-xs font-medium flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> 營業狀態</span>
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isFree ? 'text-green-400' : 'text-gray-500'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isFree ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                                    {isFree ? '現在有空' : '無狀態等待排程'}
                                  </span>
                                </div>
                                {isFree && countdownDisplay !== "未知" && (
                                  <div>
                                    <div className="w-full bg-gray-900 rounded-full h-6 relative overflow-hidden border border-black/50 shadow-inner">
                                      <div className="bg-gradient-to-r from-green-600 to-green-400 h-full transition-all duration-1000 ease-linear relative" style={{ width: `${progressPercent}%` }}>
                                        <div className="absolute inset-0 bg-white/20 w-full h-1/2 rounded-t-full"></div>
                                      </div>
                                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] tracking-wider">
                                        {countdownDisplay}
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-gray-500 text-center mt-1">剩下 {countdownDisplay}</div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right align-top pt-5">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => handleTriggerTask(task.id)}
                            disabled={task.status === 'running'}
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/30 px-3 py-1.5 rounded disabled:opacity-50 text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> 立即推文
                          </button>
                          <button
                            onClick={() => { setEditCookieTask(task); setEditCookieValue(''); setEditUsername(task.jkf_username || ''); setEditPassword(task.jkf_password || ''); }}
                            className="text-gray-500 hover:text-amber-400 text-xs px-1 py-1 transition-colors flex items-center gap-1"
                          >
                            <Cookie className="w-3 h-3" /> 編輯 Cookie
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-gray-500 hover:text-red-500 text-xs px-1 py-1 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> 刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass max-w-lg w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-6">新增 JKF 自動推文任務</h2>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">JKF 貼文網址</label>
                <input
                  type="url" required value={newTask.url} onChange={e => setNewTask({ ...newTask, url: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                  placeholder="https://www.jkforum.net/thread-..."
                />
                <p className="text-xs text-blue-400 mt-1">請貼上您要讓他自動推文的那篇文章網址。</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-300">JKF Cookies</label>
                  <button type="button" onClick={() => setShowCookieHelp(!showCookieHelp)} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={newTask.cookieString} onChange={e => setNewTask({ ...newTask, cookieString: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 font-mono text-xs"
                  placeholder="例如: bbs_sid=abc123; bbs_token=xyz789; ..."
                  rows={3}
                />
                {showCookieHelp && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2 text-xs text-blue-300 space-y-1">
                    <p className="font-medium text-blue-200">📋 如何取得 Cookies：</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-blue-300/80">
                      <li>在瀏覽器中登入 JKF 論壇</li>
                      <li>按 <kbd className="bg-white/10 px-1 rounded">F12</kbd> 開啟開發者工具</li>
                      <li>切換到 <b>Application</b>（應用程式）→ <b>Cookies</b></li>
                      <li>找到 <code className="bg-white/10 px-1 rounded">jkforum.net</code> 的所有 Cookie</li>
                      <li>或在 <b>Console</b> 輸入 <code className="bg-white/10 px-1 rounded">document.cookie</code> 按 Enter</li>
                      <li>複製結果貼上到上方欄位</li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-green-300 font-medium">⚡ 填入 JKF 帳密，Cookie 過期時系統會自動重新登入（24H 全自動）</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text" value={newTask.jkfUsername} onChange={e => setNewTask({ ...newTask, jkfUsername: e.target.value })}
                    className="bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-green-500/50 focus:outline-none"
                    placeholder="JKF 帳號"
                  />
                  <input
                    type="password" value={newTask.jkfPassword} onChange={e => setNewTask({ ...newTask, jkfPassword: e.target.value })}
                    className="bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-green-500/50 focus:outline-none"
                    placeholder="JKF 密碼"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">推文間隔 (分鐘)</label>
                <input
                  type="number" required min="10" max="1440" value={newTask.intervalMinutes} onChange={e => setNewTask({ ...newTask, intervalMinutes: parseInt(e.target.value) })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                  取消
                </button>
                <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-3 rounded-lg transition-colors flex justify-center items-center gap-2">
                  確認新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cookie / Credentials Modal */}
      {editCookieTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass max-w-lg w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Cookie className="w-5 h-5 text-amber-400" /> 編輯登入資訊</h2>
            <p className="text-sm text-gray-400 mb-4 truncate">任務: {editCookieTask.name}</p>

            <form onSubmit={handleUpdateCookie} className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-green-300 font-medium">⚡ JKF 帳密（填入後系統會自動重新登入，24H 全自動）</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-green-500/50 focus:outline-none"
                    placeholder="JKF 帳號"
                  />
                  <input
                    type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-green-500/50 focus:outline-none"
                    placeholder="JKF 密碼"
                  />
                </div>
                {editCookieTask.jkf_username && <p className="text-xs text-gray-500">目前帳號: {editCookieTask.jkf_username}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Cookie 字串 <span className="text-gray-500 font-normal">(選填)</span></label>
                <textarea
                  value={editCookieValue} onChange={e => setEditCookieValue(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 font-mono text-xs"
                  placeholder="bbs_sid=abc123; bbs_token=xyz789; ..."
                  rows={3}
                />
                <p className="text-xs text-gray-500">有填帳密的話，這欄可以留空</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditCookieTask(null)} className="flex-1 px-4 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                  取消
                </button>
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-3 rounded-lg transition-colors flex justify-center items-center gap-2">
                  儲存變更
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
