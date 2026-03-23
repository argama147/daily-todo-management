// Chrome Extension Background Service Worker

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  // Set up default storage if needed
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          refreshInterval: 300000, // 5 minutes
          notificationsEnabled: true
        }
      });
    }
  });
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});

// Message handling for communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  switch (request.action) {
    case 'getAuthToken':
      handleGetAuthToken(request.interactive, sendResponse);
      return true; // Indicates async response
      
    case 'removeAuthToken':
      handleRemoveAuthToken(request.token, sendResponse);
      return true;
      
    case 'fetchTasks':
      handleFetchTasks(request.token, sendResponse);
      return true;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Auth token management
async function handleGetAuthToken(interactive, sendResponse) {
  try {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token });
      }
    });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

function handleRemoveAuthToken(token, sendResponse) {
  try {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Task fetching with caching
async function handleFetchTasks(token, sendResponse) {
  try {
    const tasks = await fetchAllTasks(token);
    
    // Cache tasks for offline access
    chrome.storage.local.set({
      cachedTasks: tasks,
      lastFetch: Date.now()
    });
    
    sendResponse({ tasks });
  } catch (error) {
    // Try to return cached tasks on error
    chrome.storage.local.get(['cachedTasks'], (result) => {
      if (result.cachedTasks) {
        sendResponse({ 
          tasks: result.cachedTasks, 
          fromCache: true,
          error: error.message 
        });
      } else {
        sendResponse({ error: error.message });
      }
    });
  }
}

async function fetchAllTasks(token) {
  // Fetch task lists
  const listsResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!listsResponse.ok) {
    throw new Error('Failed to fetch task lists');
  }
  
  const listsData = await listsResponse.json();
  const lists = listsData.items || [];
  
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  
  const allTasks = {
    today: [],
    expired: [],
    completed: []
  };
  
  // Fetch tasks from each list
  for (const list of lists) {
    // Fetch incomplete tasks
    const incompleteTasks = await fetchTasksFromList(token, list.id, false);
    
    // Fetch completed tasks
    const completedTasks = await fetchTasksFromList(token, list.id, true);
    
    // Process incomplete tasks
    for (const task of incompleteTasks) {
      if (task.due) {
        const taskDate = task.due.slice(0, 10);
        const taskObj = {
          id: task.id,
          title: task.title || '(タイトルなし)',
          due: task.due,
          status: task.status || 'needsAction',
          listId: list.id,
          listTitle: list.title || '(リストなし)'
        };
        
        if (taskDate === today) {
          allTasks.today.push(taskObj);
        } else if (taskDate < today) {
          allTasks.expired.push(taskObj);
        }
      }
    }
    
    // Process completed tasks (only today's completed tasks)
    for (const task of completedTasks) {
      if (task.status === 'completed' && task.completed) {
        const completedDate = new Date(task.completed).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
        if (completedDate === today) {
          allTasks.completed.push({
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
  
  return allTasks;
}

async function fetchTasksFromList(token, listId, showCompleted = false) {
  const url = new URL(`https://www.googleapis.com/tasks/v1/lists/${listId}/tasks`);
  url.searchParams.append('maxResults', '100');
  url.searchParams.append('showCompleted', showCompleted.toString());
  if (showCompleted) {
    url.searchParams.append('showHidden', 'true');
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks from list ${listId}`);
  }

  const data = await response.json();
  return data.items || [];
}

// Periodic task refresh (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshTasks') {
    refreshTasksInBackground();
  }
});

async function refreshTasksInBackground() {
  try {
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (!chrome.runtime.lastError && token) {
        try {
          const tasks = await fetchAllTasks(token);
          chrome.storage.local.set({
            cachedTasks: tasks,
            lastFetch: Date.now()
          });
          
          // Optionally send notification for urgent tasks
          checkForUrgentTasks(tasks);
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }
    });
  } catch (error) {
    console.error('Background refresh error:', error);
  }
}

function checkForUrgentTasks(tasks) {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings?.notificationsEnabled) {
      const urgentCount = tasks.expired.length;
      if (urgentCount > 0) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: '期限切れタスクがあります',
          message: `${urgentCount}件のタスクが期限切れです`
        });
      }
    }
  });
}

// Set up periodic refresh alarm
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refreshTasks', { periodInMinutes: 5 });
});