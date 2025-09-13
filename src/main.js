import { auth } from './auth.js'
import { supabase } from './supabase.js'

// Kontrola existující session
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    localStorage.setItem('user', JSON.stringify(session.user))
    afterLogin()
  }
}

// Po přihlášení nebo při načtení session zobrazit email
async function showUserBar() {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    document.getElementById('user-email').textContent = user.email
    document.getElementById('user-bar').style.display = 'flex'
  } else {
    document.getElementById('user-bar').style.display = 'none'
  }
}

// Logout handler
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut()
  localStorage.removeItem('user')
  document.getElementById('app-container').style.display = 'none'
  document.getElementById('login-container').style.display = 'flex'
})

// Po úspěšném přihlášení nebo při načtení session:
async function afterLogin() {
  document.getElementById('login-container').style.display = 'none'
  document.getElementById('app-container').style.display = 'block'
  await showUserBar()
  loadTasks()
}

// Test že máme spojení se Supabase
console.log('Checking connection...')

// Přihlášení
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    })
    
    if (error) throw error
    
    // Uložíme session
    localStorage.setItem('user', JSON.stringify(data.user))
    
    afterLogin()
  } catch (error) {
    alert('Chyba přihlášení: ' + error.message)
  }
})

// Registrace
document.getElementById('register-btn').addEventListener('click', async () => {
  console.log('Register attempt...')
  
  try {
    await auth.register(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    )
    alert('Registrace úspěšná! Zkontrolujte email.')
  } catch (error) {
    console.error('Register error:', error)
    alert(error.message)
  }
})

// Globální proměnná pro filtr
window.currentFilter = 'all'

// Přidáme globální event listenery
document.addEventListener('DOMContentLoaded', () => {
  const addTaskBtn = document.getElementById('add-task-btn')
  const advancedForm = document.getElementById('advanced-form')
  const cancelBtn = document.getElementById('cancel-btn')
  const saveBtn = document.getElementById('save-btn')
  const filterButtons = document.querySelectorAll('.filter-btn')

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      window.currentFilter = btn.getAttribute('data-filter')
      loadTasks()
    })
  })

  // Zobrazení formuláře
  addTaskBtn.addEventListener('click', () => {
    console.log('Opening form...')
    clearTaskForm()
    advancedForm.style.display = 'block'
    advancedForm.classList.add('active')
  })

  // Zavření formuláře
  cancelBtn.addEventListener('click', () => {
    console.log('Closing form...')
    advancedForm.classList.remove('active')
    setTimeout(() => {
      advancedForm.style.display = 'none'
    }, 300)
  })

  // ODEBER TENTO BLOK, pokud už je níže nebo výše v souboru!
  // Uložení úkolu - handler pouze jednou!
  if (!saveBtn._handlerAttached) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      const taskText = document.getElementById('task-text').value
      if (!taskText) {
        alert('Zadejte název úkolu')
        return
      }

      try {
        const user = JSON.parse(localStorage.getItem('user'))
        if (!user) throw new Error('Nejste přihlášeni')

        const task = {
          user_id: user.id,
          text: taskText,
          category: document.getElementById('task-category').value,
          priority: document.getElementById('task-priority').value,
          due_date: document.getElementById('task-due-date').value || null,
          notes: document.getElementById('task-notes').value,
          time_estimate: document.getElementById('task-time-estimate').value,
          repeat: document.getElementById('task-repeat').value,
          completed: false
        }

        if (editingTaskId) {
          const { error } = await supabase
            .from('todos')
            .update(task)
            .eq('id', editingTaskId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('todos').insert([task])
          if (error) throw error
        }

        advancedForm.classList.remove('active')
        setTimeout(() => {
          advancedForm.style.display = 'none'
          clearTaskForm()
          editingTaskId = null
          loadTasks()
        }, 300)
      } catch (error) {
        console.error('Error saving task:', error)
        alert('Chyba při ukládání úkolu: ' + error.message)
      }
    })
    saveBtn._handlerAttached = true
  }
})

// !!! OPRAVA: Funkci loadTasks deklaruj pouze jednou v celém souboru !!!

let editingTaskId = null;

function clearTaskForm() {
  document.getElementById('task-text').value = ''
  document.getElementById('task-category').value = ''
  document.getElementById('task-priority').value = 'low'
  document.getElementById('task-due-date').value = ''
  document.getElementById('task-notes').value = ''
  document.getElementById('task-time-estimate').value = ''
  document.getElementById('task-repeat').value = ''
  editingTaskId = null
}

// Mapování kategorií
const categoryLabels = {
  'work': '🏢 Práce',
  'personal': '👤 Osobní',
  'shopping': '🛒 Nákupy',
  'health': '❤️ Zdraví',
  'study': '📚 Studium',
  'finance': '💰 Finance'
}

// Pomocná funkce pro formátování data
function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('cs-CZ')
}

// Přidej funkci pro aktualizaci statistik
function updateStats(tasks) {
  // Statistika pouze pro nesmazané úkoly
  const visibleTasks = tasks.filter(t => !t.deleted)
  const total = visibleTasks.length

  // Dnešní datum v místním časovém pásmu (YYYY-MM-DD)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  // Hotovo dnes: completed=true a updated_at je dnes (funguje i bez completed_at)
  const completedToday = visibleTasks.filter(
    t =>
      t.completed &&
      t.updated_at &&
      new Date(t.updated_at).toISOString().slice(0, 10) === todayStr
  ).length

  // Série dní s dokončeným úkolem (streak) - stále podle due_date
  let streak = 0
  let date = new Date()
  date.setHours(0, 0, 0, 0)
  while (true) {
    const dateStr = date.toISOString().slice(0, 10)
    if (visibleTasks.some(t =>
      t.completed &&
      t.due_date &&
      new Date(t.due_date).toISOString().slice(0, 10) === dateStr
    )) {
      streak++
      date.setDate(date.getDate() - 1)
    } else {
      break
    }
  }
  const completed = visibleTasks.filter(t => t.completed).length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  document.getElementById('total-tasks').textContent = total
  document.getElementById('completed-today').textContent = completedToday
  document.getElementById('streak-days').textContent = streak
  document.getElementById('progress-fill').style.width = progress + '%'
  document.getElementById('progress-text').textContent = `${progress}% dokončeno`
  document.getElementById('task-summary').textContent =
    total === 0 ? 'Žádné úkoly' : `${completed} z ${total} dokončeno`
}

// Aktualizace UI s úkoly
function updateTaskList(tasks) {
  const todoList = document.getElementById('todo-list')
  const emptyState = document.getElementById('empty-state')
  
  if (!tasks || tasks.length === 0) {
    todoList.innerHTML = ''
    emptyState.style.display = 'flex'
    updateStats([]) // statistiky na nulu
    return
  }

  emptyState.style.display = 'none'
  todoList.innerHTML = tasks.map(task => `
    <div class="todo-box ${task.completed ? 'completed' : ''} priority-${task.priority}" data-id="${task.id}">
      <div class="desktop-checkbox ${task.completed ? 'completed' : ''}" onclick="toggleTask('${task.id}')" ${task.deleted ? 'style="opacity:0.3;pointer-events:none;"' : ''}></div>
      <div class="todo-content">
        <span class="todo-text-span">${task.text}</span>
        <div class="todo-meta">
          ${task.category ? `<span class="todo-category ${task.category}">${categoryLabels[task.category] || task.category}</span>` : ''}
          ${task.due_date ? `<span class="todo-due-date">${formatDate(task.due_date)}</span>` : ''}
        </div>
        ${task.notes ? `<div class="todo-notes">${task.notes}</div>` : ''}
      </div>
      <div class="todo-actions">
        ${task.deleted
          ? `<button class="delete-btn perma-delete-btn" data-id="${task.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>`
          : `
        <button class="edit-btn" onclick="editTask('${task.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete-btn" onclick="deleteTask('${task.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        `}
      </div>
    </div>
  `).join('')

  // Funkční trvalé mazání přes event delegation
  document.querySelectorAll('.perma-delete-btn').forEach(btn => {
    btn.onclick = function(e) {
      const id = btn.getAttribute('data-id')
      window.permaDeleteTask(id)
    }
  })
  // Načti všechny úkoly uživatele (včetně smazaných) a aktualizuj statistiky
  loadAllTasksForStats()
}

// Globální funkce pro akční tlačítka
window.toggleTask = async (id) => {
  try {
    const { data: task } = await supabase
      .from('todos')
      .select('completed')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('todos')
      .update({ completed: !task.completed })
      .eq('id', id)

    if (error) throw error
    loadTasks()
  } catch (error) {
    console.error('Error toggling task:', error)
  }
}

window.deleteTask = async (id) => {
  if (!confirm('Opravdu chcete přesunout tento úkol do koše?')) return

  try {
    // Soft delete: nastavíme deleted: true místo mazání
    const { error } = await supabase
      .from('todos')
      .update({ deleted: true })
      .eq('id', id)

    if (error) throw error
    loadTasks()
  } catch (error) {
    console.error('Error deleting task:', error)
  }
}

// Trvalé smazání úkolu ze "Smazaných"
window.permaDeleteTask = async (id) => {
  if (!confirm('Opravdu trvale smazat tento úkol?')) return

  try {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)

    if (error) throw error
    loadTasks()
  } catch (error) {
    console.error('Error permanently deleting task:', error)
  }
}

window.editTask = async (id) => {
  try {
    const { data: task, error } = await supabase
      .from('todos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    document.getElementById('task-text').value = task.text || ''
    document.getElementById('task-category').value = task.category || ''
    document.getElementById('task-priority').value = task.priority || 'low'
    document.getElementById('task-due-date').value = task.due_date || ''
    document.getElementById('task-notes').value = task.notes || ''
    document.getElementById('task-time-estimate').value = task.time_estimate || ''
    document.getElementById('task-repeat').value = task.repeat || ''
    editingTaskId = id

    document.getElementById('advanced-form').style.display = 'block'
    document.getElementById('advanced-form').classList.add('active')
  } catch (error) {
    console.error('Error editing task:', error)
  }
}

// Přidání event listenerů pouze jednou!
document.addEventListener('DOMContentLoaded', () => {
  const addTaskBtn = document.getElementById('add-task-btn')
  const advancedForm = document.getElementById('advanced-form')
  const cancelBtn = document.getElementById('cancel-btn')
  const saveBtn = document.getElementById('save-btn')
  const filterButtons = document.querySelectorAll('.filter-btn')

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      window.currentFilter = btn.getAttribute('data-filter')
      loadTasks()
    })
  })

  // Zobrazení formuláře
  addTaskBtn.addEventListener('click', () => {
    clearTaskForm()
    advancedForm.style.display = 'block'
    advancedForm.classList.add('active')
  })

  // Zavření formuláře
  cancelBtn.addEventListener('click', () => {
    advancedForm.classList.remove('active')
    setTimeout(() => {
      advancedForm.style.display = 'none'
    }, 300)
  })

  // ODEBER TENTO BLOK, pokud už je níže nebo výše v souboru!
  // Uložení úkolu - handler pouze jednou!
  if (!saveBtn._handlerAttached) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      const taskText = document.getElementById('task-text').value
      if (!taskText) {
        alert('Zadejte název úkolu')
        return
      }

      try {
        const user = JSON.parse(localStorage.getItem('user'))
        if (!user) throw new Error('Nejste přihlášeni')

        const task = {
          user_id: user.id,
          text: taskText,
          category: document.getElementById('task-category').value,
          priority: document.getElementById('task-priority').value,
          due_date: document.getElementById('task-due-date').value || null,
          notes: document.getElementById('task-notes').value,
          time_estimate: document.getElementById('task-time-estimate').value,
          repeat: document.getElementById('task-repeat').value,
          completed: false
        }

        if (editingTaskId) {
          const { error } = await supabase
            .from('todos')
            .update(task)
            .eq('id', editingTaskId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('todos').insert([task])
          if (error) throw error
        }

        advancedForm.classList.remove('active')
        setTimeout(() => {
          advancedForm.style.display = 'none'
          clearTaskForm()
          editingTaskId = null
          loadTasks()
        }, 300)
      } catch (error) {
        console.error('Error saving task:', error)
        alert('Chyba při ukládání úkolu: ' + error.message)
      }
    })
    saveBtn._handlerAttached = true
  }
})

// --- ZDE JE SPRÁVNĚ JEN JEDNA DEFINICE FUNKCE FUNKCE loadTasks ---
async function loadTasks() {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user) return

    let query = supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Filtrování podle typu
    switch (window.currentFilter) {
      case 'active':
        query = query.eq('completed', false).eq('deleted', false)
        break
      case 'completed':
        query = query.eq('completed', true).eq('deleted', false)
        break
      case 'overdue':
        query = query.eq('completed', false).eq('deleted', false).lt('due_date', new Date().toISOString().slice(0, 10))
        break
      case 'today':
        const today = new Date().toISOString().slice(0, 10)
        query = query.eq('due_date', today).eq('deleted', false)
        break
      case 'deleted':
        query = query.eq('deleted', true)
        break
      default:
        // 'all' - zobraz jen nesmazané
        query = query.eq('deleted', false)
        break
    }

    const { data: tasks, error } = await query

    if (error) throw error

    updateTaskList(tasks)
  } catch (error) {
    console.error('Error loading tasks:', error)
  }
}

// Funkce pro načtení všech úkolů uživatele (včetně smazaných) a aktualizaci statistik
async function loadAllTasksForStats() {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user) {
      updateStats([])
      return
    }
    const { data: allTasks, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
    if (error) throw error
    updateStats(allTasks || [])
  } catch (error) {
    updateStats([])
  }
}

// Spustit kontrolu session při načtení stránky
checkSession()