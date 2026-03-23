// Chrome Extension Popup JavaScript
class TaskManager {
  constructor() {
    this.user = null;
    this.tasks = {
      today: [],
      expired: [],
      completed: []
    };
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthStatus();
  }

  setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', () => this.login());
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    document.getElementById('refresh-btn').addEventListener('click', () => this.refreshTasks());
  }

  async checkAuthStatus() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      if (token) {
        await this.getUserInfo(token);
        this.showMainInterface();
        await this.loadTasks(token);
      } else {
        this.showLoginInterface();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showLoginInterface();
    }
  }

  async login() {
    try {
      const loginBtn = document.getElementById('login-btn');
      loginBtn.disabled = true;
      loginBtn.textContent = 'ログイン中...';

      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      await this.getUserInfo(token);
      this.showMainInterface();
      await this.loadTasks(token);
    } catch (error) {
      console.error('Login failed:', error);
      this.showError('ログインに失敗しました: ' + error.message);
    } finally {
      const loginBtn = document.getElementById('login-btn');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Googleでログイン';
    }
  }

  async logout() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      if (token) {
        chrome.identity.removeCachedAuthToken({ token });
      }

      this.user = null;
      this.tasks = { today: [], expired: [], completed: [] };
      this.showLoginInterface();
    } catch (error) {
      console.error('Logout failed:', error);
      this.showError('ログアウトに失敗しました');
    }
  }

  async getUserInfo(token) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('ユーザー情報の取得に失敗しました');
      }

      this.user = await response.json();
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  async loadTasks(token) {
    try {
      this.showLoading(true);
      this.hideError();

      const [todayTasks, expiredTasks, completedTasks] = await Promise.all([
        this.fetchTodayTasks(token),
        this.fetchExpiredTasks(token),
        this.fetchCompletedTasks(token)
      ]);

      this.tasks = {
        today: todayTasks,
        expired: expiredTasks,
        completed: completedTasks
      };

      this.renderTasks();
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.showError('タスクの取得に失敗しました: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async fetchTodayTasks(token) {
    const lists = await this.fetchTaskLists(token);
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    const tasks = [];

    for (const list of lists) {
      const listTasks = await this.fetchTasksFromList(token, list.id, false);
      for (const task of listTasks) {
        if (task.due) {
          const taskDate = task.due.slice(0, 10);
          if (taskDate === todayStr) {
            tasks.push({
              id: task.id,
              title: task.title || '(タイトルなし)',
              due: task.due,
              status: task.status || 'needsAction',
              listId: list.id,
              listTitle: list.title || '(リストなし)'
            });
          }
        }
      }
    }

    return tasks;
  }

  async fetchExpiredTasks(token) {
    const lists = await this.fetchTaskLists(token);
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    const tasks = [];

    for (const list of lists) {
      const listTasks = await this.fetchTasksFromList(token, list.id, false);
      for (const task of listTasks) {
        if (task.due) {
          const taskDate = task.due.slice(0, 10);
          if (taskDate < todayStr) {
            tasks.push({
              id: task.id,
              title: task.title || '(タイトルなし)',
              due: task.due,
              status: task.status || 'needsAction',
              listId: list.id,
              listTitle: list.title || '(リストなし)'
            });
          }
        }
      }
    }

    return tasks;
  }

  async fetchCompletedTasks(token) {
    const lists = await this.fetchTaskLists(token);
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    const tasks = [];

    for (const list of lists) {
      const listTasks = await this.fetchTasksFromList(token, list.id, true);
      for (const task of listTasks) {
        if (task.status === 'completed' && task.completed) {
          const completedDate = new Date(task.completed).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
          if (completedDate === todayStr) {
            tasks.push({
              id: task.id,
              title: task.title || '(タイトルなし)',
              due: task.due || '',
              status: task.status,
              listId: list.id,
              listTitle: list.title || '(リストなし)'
            });
          }
        }
      }
    }

    return tasks;
  }

  async fetchTaskLists(token) {
    const response = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('タスクリストの取得に失敗しました');
    }

    const data = await response.json();
    return data.items || [];
  }

  async fetchTasksFromList(token, listId, showCompleted = false) {
    const url = new URL('https://www.googleapis.com/tasks/v1/lists/' + listId + '/tasks');
    url.searchParams.append('maxResults', '100');
    url.searchParams.append('showCompleted', showCompleted.toString());
    if (showCompleted) {
      url.searchParams.append('showHidden', 'true');
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('タスクの取得に失敗しました');
    }

    const data = await response.json();
    return data.items || [];
  }

  async refreshTasks() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      if (token) {
        await this.loadTasks(token);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      this.showError('更新に失敗しました');
    }
  }

  async completeTask(task) {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      await this.updateTaskStatus(token, task.listId, task.id, 'completed');
      
      // Update local state
      this.tasks.today = this.tasks.today.filter(t => t.id !== task.id);
      this.tasks.expired = this.tasks.expired.filter(t => t.id !== task.id);
      this.tasks.completed.unshift(task);
      
      this.renderTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
      this.showError('タスクの完了に失敗しました');
    }
  }

  async uncompleteTask(task) {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      await this.updateTaskStatus(token, task.listId, task.id, 'needsAction');
      
      // Update local state
      this.tasks.completed = this.tasks.completed.filter(t => t.id !== task.id);
      
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      const taskDate = task.due ? task.due.slice(0, 10) : todayStr;
      
      if (taskDate < todayStr) {
        this.tasks.expired.unshift(task);
      } else {
        this.tasks.today.unshift(task);
      }
      
      this.renderTasks();
    } catch (error) {
      console.error('Failed to uncomplete task:', error);
      this.showError('タスクの未完了への変更に失敗しました');
    }
  }

  async updateTaskStatus(token, listId, taskId, status) {
    const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error('タスクの更新に失敗しました');
    }

    return response.json();
  }

  renderTasks() {
    this.renderTaskColumn('expired', this.tasks.expired, 'expired');
    this.renderTaskColumn('today', this.tasks.today, 'today');
    this.renderTaskColumn('completed', this.tasks.completed, 'completed');
    
    // Update counts
    document.getElementById('expired-count').textContent = `(${this.tasks.expired.length}件)`;
    document.getElementById('today-count').textContent = `(${this.tasks.today.length}件)`;
    document.getElementById('completed-count').textContent = `(${this.tasks.completed.length}件)`;
  }

  renderTaskColumn(columnId, tasks, type) {
    const container = document.getElementById(`${columnId}-tasks`);
    
    if (tasks.length === 0) {
      if (type === 'today' && this.tasks.expired.length === 0 && this.tasks.completed.length === 0) {
        container.innerHTML = `
          <div class="empty-all">
            <div class="emoji">🎉</div>
            <p>今日期限のタスクはありません</p>
          </div>
        `;
      } else {
        const message = type === 'expired' ? '期限切れタスクがここに表示されます' :
                       type === 'today' ? 'すべて完了しました！' :
                       '完了したタスクがここに表示されます';
        container.innerHTML = `<div class="empty-state">${message}</div>`;
      }
      return;
    }

    container.innerHTML = tasks.map(task => this.renderTask(task, type)).join('');
    
    // Add event listeners
    container.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        const taskId = e.target.closest('.task-item').dataset.taskId;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          if (type === 'completed') {
            this.uncompleteTask(task);
          } else {
            this.completeTask(task);
          }
        }
      });
    });
  }

  renderTask(task, type) {
    const isCompleted = type === 'completed';
    const isExpired = type === 'expired';
    
    let dueBadge = '';
    if (isExpired && task.due) {
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
      const taskDate = task.due.slice(0, 10);
      const diffTime = new Date(todayStr).getTime() - new Date(taskDate).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const dueText = new Date(task.due).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
      dueBadge = `<span class="task-badge due">期限: ${dueText} (${diffDays}日経過)</span>`;
    }

    const checkmarkIcon = isCompleted ? `
      <svg class="checkmark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ` : '';

    return `
      <div class="task-item ${type}" data-task-id="${task.id}">
        <div class="task-checkbox">
          ${checkmarkIcon}
        </div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="task-badge list">${task.listTitle}</span>
            ${dueBadge}
          </div>
        </div>
      </div>
    `;
  }

  showLoginInterface() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('main-container').classList.add('hidden');
  }

  showMainInterface() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('main-container').classList.remove('hidden');
    
    // Update date
    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
    document.getElementById('today-date').textContent = today;
    
    // Update user info
    if (this.user) {
      const userInfo = document.getElementById('user-info');
      userInfo.innerHTML = `
        ${this.user.picture ? `<img src="${this.user.picture}" alt="${this.user.name || 'ユーザー'}">` : ''}
        <span>${this.user.name || this.user.email}</span>
      `;
    }
  }

  showLoading(show) {
    const loading = document.getElementById('loading');
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (show) {
      loading.classList.remove('hidden');
      refreshBtn.disabled = true;
      refreshBtn.textContent = '更新中...';
    } else {
      loading.classList.add('hidden');
      refreshBtn.disabled = false;
      refreshBtn.textContent = '更新';
    }
  }

  showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  hideError() {
    document.getElementById('error-message').classList.add('hidden');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TaskManager();
});