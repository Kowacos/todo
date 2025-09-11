// Debug: Kontrola načtení skriptu
console.log('JavaScript se načetl úspěšně!');

// Import a inicializace PocketBase klienta
import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.1/dist/pocketbase.es.mjs';
const pb = new PocketBase('https://a60fd21464f9.ngrok-free.app');

// Čekáme na načtení DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM je načten!');

    // Kontrola DOM prvků
    const todoList = document.getElementById('todo-list');
    const taskSummary = document.getElementById('task-summary');
    const emptyState = document.getElementById('empty-state');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const newTodoContainer = document.getElementById('new-todo-container');
    const advancedForm = document.getElementById('advanced-form');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    // Search elements
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');

    // Stats elements
    const totalTasksEl = document.getElementById('total-tasks');
    const completedTodayEl = document.getElementById('completed-today');
    const streakDaysEl = document.getElementById('streak-days');

    // Bulk actions elements
    const bulkActions = document.getElementById('bulk-actions');
    const bulkCompleteBtn = document.getElementById('bulk-complete');
    const bulkDeleteBtn = document.getElementById('bulk-delete');
    const clearCompletedBtn = document.getElementById('clear-completed');

    // Form elements
    const taskTextInput = document.getElementById('task-text');
    const taskCategorySelect = document.getElementById('task-category');
    const taskPrioritySelect = document.getElementById('task-priority');
    const taskDueDateInput = document.getElementById('task-due-date');
    const taskNotesInput = document.getElementById('task-notes');
    const taskTimeEstimateSelect = document.getElementById('task-time-estimate');
    const taskRepeatSelect = document.getElementById('task-repeat');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle');

    let currentFilter = 'all';
    let currentSearchTerm = '';
    let draggedElement = null;
    let editingTodoItem = null;

    /**
     * Zobrazí toast notifikaci
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Aktualizuje progress bar a souhrn úkolů
     */
    function updateTaskSummary() {
        const allItems = todoList.querySelectorAll('.todo-box:not(.deleted)');
        const activeItems = todoList.querySelectorAll('.todo-box:not(.completed):not(.deleted)');
        const completedItems = todoList.querySelectorAll('.todo-box.completed:not(.deleted)');
        const deletedItems = todoList.querySelectorAll('.todo-box.deleted');

        const totalCount = allItems.length;
        const activeCount = activeItems.length;
        const completedCount = completedItems.length;
        const deletedCount = deletedItems.length;

        // Progress bar
        const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        progressFill.style.width = progressPercentage + '%';
        progressText.textContent = `${progressPercentage}% dokončeno`;

        // Aktualizace souhrnu v hlavičce
        if (totalCount === 0 && deletedCount === 0) {
            taskSummary.textContent = 'Žádné úkoly';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            if (currentFilter === 'deleted') {
                taskSummary.textContent = `${deletedCount} smazaných úkolů`;
            } else if (activeCount === 0 && completedCount > 0) {
                taskSummary.textContent = `Všechny úkoly dokončeny! 🎉`;
            } else if (completedCount === 0) {
                taskSummary.textContent = `${activeCount} ${getTaskWord(activeCount)}`;
            } else {
                taskSummary.textContent = `${activeCount} aktivních, ${completedCount} dokončených`;
            }
        }

        // Zobrazení/skrytí bulk actions
        if (totalCount > 0 && currentFilter !== 'deleted') {
            bulkActions.style.display = 'block';
        } else {
            bulkActions.style.display = 'none';
        }

        // Kontrola overdue úkolů
        checkOverdueTasks();
    }

    /**
     * Vrátí správné slovo pro počet úkolů
     */
    function getTaskWord(count) {
        if (count === 1) return 'úkol';
        if (count < 5) return 'úkoly';
        return 'úkolů';
    }

    /**
     * Kontroluje úkoly s prošlým termínem
     */
    function checkOverdueTasks() {
        const today = new Date().toISOString().split('T')[0];
        const allItems = todoList.querySelectorAll('.todo-box:not(.completed):not(.deleted)');

        allItems.forEach(item => {
            const dueDate = item.dataset.dueDate;
            if (dueDate) {
                item.classList.remove('overdue', 'due-today');
                if (dueDate < today) {
                    item.classList.add('overdue');
                } else if (dueDate === today) {
                    item.classList.add('due-today');
                }
            }
        });
    }

    /**
     * Načte úkoly z PocketBase
     */
    async function loadTodos() {
        try {
            const records = await pb.collection('todos').getFullList({
                sort: '-created',
            });
            records.forEach(todo => addTodoToDOM(todo, false));
            updateTaskSummary();
            updateStats();
        } catch (error) {
            console.error('Chyba při načítání úkolů z PocketBase:', error);
            showToast('Chyba při načítání úkolů', 'error');
        }
    }

    /**
     * Formátuje časový odhad pro zobrazení
     */
    function formatTimeEstimate(minutes) {
        if (!minutes) return '';
        const num = parseInt(minutes);
        if (num < 60) return `${num} min`;
        if (num < 480) return `${Math.round(num / 60)} h`;
        return 'Celý den';
    }

    /**
     * Vrátí název opakování
     */
    function getRepeatName(repeat) {
        const names = {
            daily: 'Denně',
            weekly: 'Týdně',
            monthly: 'Měsíčně'
        };
        return names[repeat] || '';
    }

    /**
     * Formátuje datum pro zobrazení
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dateStr = date.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        if (dateStr === todayStr) return 'Dnes';
        if (dateStr === tomorrowStr) return 'Zítra';

        return date.toLocaleDateString('cs-CZ', {
            day: 'numeric',
            month: 'short'
        });
    }

    /**
     * Vytvoří action tlačítka pro todo item
     */
    function createTodoActions(todoItem, todo) {
        const todoActions = document.createElement('div');
        todoActions.classList.add('todo-actions');

        if (todo.deleted) {
            // Tlačítka pro smazané úkoly
            const restoreButton = document.createElement('button');
            restoreButton.classList.add('restore-btn');
            restoreButton.innerHTML = '↩️';
            restoreButton.title = 'Obnovit úkol';
            restoreButton.addEventListener('click', () => restoreTodo(todoItem));
            todoActions.appendChild(restoreButton);

            const permanentDeleteButton = document.createElement('button');
            permanentDeleteButton.classList.add('permanent-delete-btn');
            permanentDeleteButton.innerHTML = '❌';
            permanentDeleteButton.title = 'Trvale smazat';
            permanentDeleteButton.addEventListener('click', () => permanentDeleteTodo(todoItem));
            todoActions.appendChild(permanentDeleteButton);
        } else {
            // Normální tlačítka
            const editButton = document.createElement('button');
            editButton.classList.add('edit-btn');
            editButton.innerHTML = '✏️';
            editButton.title = 'Upravit úkol';
            editButton.addEventListener('click', () => editTodo(todoItem, todo));
            todoActions.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-btn');
            deleteButton.innerHTML = '🗑️';
            deleteButton.title = 'Smazat úkol';
            deleteButton.addEventListener('click', () => deleteTodo(todoItem));
            todoActions.appendChild(deleteButton);
        }

        return todoActions;
    }

    /**
     * Přidá úkol do DOMu s pokročilými funkcemi
     */
    function addTodoToDOM(todo, isNew = false) {
        const newTodoItem = document.createElement('div');
        newTodoItem.classList.add('todo-box');

        // Přidání tříd pro prioritu a stav
        if (todo.priority) {
            newTodoItem.classList.add(`priority-${todo.priority}`);
        }
        if (todo.completed) {
            newTodoItem.classList.add('completed');
        }
        if (todo.deleted) {
            newTodoItem.classList.add('deleted');
        }

        // Uložení dat do datasetu
        newTodoItem.dataset.id = todo.id;
        newTodoItem.dataset.category = todo.category || '';
        newTodoItem.dataset.priority = todo.priority || 'low';
        newTodoItem.dataset.dueDate = todo.dueDate || '';
        newTodoItem.dataset.notes = todo.notes || '';
        newTodoItem.dataset.timeEstimate = todo.timeEstimate || '';
        newTodoItem.dataset.repeat = todo.repeat || '';
        newTodoItem.dataset.createdAt = todo.createdAt || new Date().toISOString();
        newTodoItem.dataset.deletedAt = todo.deletedAt || '';
        newTodoItem.dataset.completedAt = todo.completedAt || '';

        // Desktop checkbox - pouze pro nesmazané úkoly
        if (!todo.deleted) {
            const checkbox = document.createElement('div');
            checkbox.classList.add('desktop-checkbox');
            if (todo.completed) {
                checkbox.classList.add('completed');
            }
            checkbox.addEventListener('click', async () => {
                const wasCompleted = newTodoItem.classList.contains('completed');
                newTodoItem.classList.toggle('completed');
                checkbox.classList.toggle('completed');

                // Uložení času dokončení
                if (!wasCompleted) {
                    newTodoItem.dataset.completedAt = new Date().toISOString();
                    showCompletionAnimation(newTodoItem);
                    saveCompletionDate();
                    showToast('Úkol dokončen!');
                } else {
                    newTodoItem.dataset.completedAt = '';
                }

                await pb.collection('todos').update(newTodoItem.dataset.id, {
                    completed: newTodoItem.classList.contains('completed'),
                    completedAt: newTodoItem.dataset.completedAt || null
                });

                filterTodos(currentFilter);
            });
            newTodoItem.appendChild(checkbox);
        }

        // Obsah úkolu
        const todoContent = document.createElement('div');
        todoContent.classList.add('todo-content');

        const todoTextSpan = document.createElement('span');
        todoTextSpan.classList.add('todo-text-span');
        todoTextSpan.textContent = todo.text;
        todoContent.appendChild(todoTextSpan);

        // Meta informace
        const todoMeta = document.createElement('div');
        todoMeta.classList.add('todo-meta');

        if (todo.category) {
            const categorySpan = document.createElement('span');
            categorySpan.classList.add('todo-category', todo.category);
            categorySpan.textContent = getCategoryName(todo.category);
            todoMeta.appendChild(categorySpan);
        }

        if (todo.dueDate) {
            const dueDateSpan = document.createElement('span');
            dueDateSpan.classList.add('todo-due-date');
            dueDateSpan.textContent = formatDate(todo.dueDate);

            const today = new Date().toISOString().split('T')[0];
            if (todo.dueDate < today && !todo.completed) {
                dueDateSpan.classList.add('overdue');
            } else if (todo.dueDate === today) {
                dueDateSpan.classList.add('today');
            }

            todoMeta.appendChild(dueDateSpan);
        }

        if (todo.timeEstimate) {
            const timeEstimateSpan = document.createElement('span');
            timeEstimateSpan.classList.add('todo-time-estimate');
            timeEstimateSpan.textContent = formatTimeEstimate(todo.timeEstimate);
            todoMeta.appendChild(timeEstimateSpan);
        }

        if (todo.repeat) {
            const repeatSpan = document.createElement('span');
            repeatSpan.classList.add('todo-repeat-indicator');
            repeatSpan.textContent = getRepeatName(todo.repeat);
            todoMeta.appendChild(repeatSpan);
        }

        if (todoMeta.children.length > 0) {
            todoContent.appendChild(todoMeta);
        }

        // Poznámky (skryté, zobrazí se po kliknutí)
        if (todo.notes) {
            const notesDiv = document.createElement('div');
            notesDiv.classList.add('todo-notes');
            notesDiv.textContent = todo.notes;
            todoContent.appendChild(notesDiv);

            newTodoItem.classList.add('has-notes');

            // Přidání indikátoru rozbalení
            const expandIndicator = document.createElement('span');
            expandIndicator.classList.add('expand-indicator');
            expandIndicator.textContent = '▼';
            todoTextSpan.appendChild(expandIndicator);

            // Kliknutí pro rozbalení/sbalení poznámek
            todoContent.addEventListener('click', (e) => {
                if (!e.target.closest('.todo-actions')) {
                    newTodoItem.classList.toggle('expanded');
                }
            });
        }

        newTodoItem.appendChild(todoContent);

        // Akční tlačítka
        const todoActions = createTodoActions(newTodoItem, todo);
        newTodoItem.appendChild(todoActions);

        // Přidání drag & drop funkcionalitu (pouze pro nesmazané úkoly)
        if (!todo.deleted) {
            addDragAndDrop(newTodoItem);
        }

        if (isNew) {
            todoList.prepend(newTodoItem);
            // Animace pro nový úkol
            newTodoItem.style.transform = 'translateY(-20px)';
            newTodoItem.style.opacity = '0';
            setTimeout(() => {
                newTodoItem.style.transform = 'translateY(0)';
                newTodoItem.style.opacity = '1';
            }, 10);
        } else {
            todoList.appendChild(newTodoItem);
        }
    }

    /**
     * Aktualizuje action tlačítka pro existující todo item
     */
    function updateTodoActions(todoItem) {
        const existingActions = todoItem.querySelector('.todo-actions');
        if (existingActions) {
            existingActions.remove();
        }

        const todo = {
            deleted: todoItem.classList.contains('deleted'),
            text: todoItem.querySelector('.todo-text-span').textContent,
            category: todoItem.dataset.category,
            priority: todoItem.dataset.priority,
            dueDate: todoItem.dataset.dueDate,
            notes: todoItem.dataset.notes,
            timeEstimate: todoItem.dataset.timeEstimate,
            repeat: todoItem.dataset.repeat,
            createdAt: todoItem.dataset.createdAt,
            completed: todoItem.classList.contains('completed')
        };

        const newActions = createTodoActions(todoItem, todo);
        todoItem.appendChild(newActions);
    }

    /**
     * Vrátí název kategorie
     */
    function getCategoryName(category) {
        const names = {
            work: 'Práce',
            personal: 'Osobní',
            shopping: 'Nákupy',
            health: 'Zdraví',
            study: 'Studium',
            finance: 'Finance'
        };
        return names[category] || category;
    }

    /**
     * Zobrazí animaci dokončení úkolu
     */
    function showCompletionAnimation(todoItem) {
        // Vytvoření konfety efektu
        const confetti = document.createElement('div');
        confetti.innerHTML = '🎉';
        confetti.style.position = 'absolute';
        confetti.style.fontSize = '24px';
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '1000';

        const rect = todoItem.getBoundingClientRect();
        confetti.style.left = rect.right - 30 + 'px';
        confetti.style.top = rect.top + 'px';

        document.body.appendChild(confetti);

        // Animace konfety
        confetti.animate([
            { transform: 'translateY(0) scale(1)', opacity: 1 },
            { transform: 'translateY(-30px) scale(1.5)', opacity: 0 }
        ], {
            duration: 800,
            easing: 'ease-out'
        }).onfinish = () => confetti.remove();
    }

    /**
     * Upraví existující úkol
     */
    function editTodo(todoItem, todo) {
        // Naplnění formuláře současnými hodnotami
        taskTextInput.value = todo.text;
        taskCategorySelect.value = todo.category || '';
        taskPrioritySelect.value = todo.priority || 'low';
        taskDueDateInput.value = todo.dueDate || '';
        taskNotesInput.value = todo.notes || '';
        taskTimeEstimateSelect.value = todo.timeEstimate || '';
        taskRepeatSelect.value = todo.repeat || '';

        advancedForm.classList.add('active');
        taskTextInput.focus();

        // Uložení reference na upravovaný úkol
        editingTodoItem = todoItem;
        saveBtn.textContent = '💾 Upravit úkol';
    }

    /**
     * Soft delete úkolu
     */
    async function deleteTodo(todoItem) {
        todoItem.classList.add('deleted');
        todoItem.dataset.deletedAt = new Date().toISOString();

        // Odebrání checkboxu a drag & drop
        const checkbox = todoItem.querySelector('.desktop-checkbox');
        if (checkbox) checkbox.remove();
        todoItem.draggable = false;

        // Aktualizace action tlačítek
        updateTodoActions(todoItem);

        await pb.collection('todos').update(todoItem.dataset.id, {
            deleted: true,
            deletedAt: todoItem.dataset.deletedAt
        });

        filterTodos(currentFilter);
        showToast('Úkol byl smazán');
    }

    /**
     * Obnoví smazaný úkol
     */
    async function restoreTodo(todoItem) {
        todoItem.classList.remove('deleted');
        delete todoItem.dataset.deletedAt;

        // Přidání checkboxu zpět
        const checkbox = document.createElement('div');
        checkbox.classList.add('desktop-checkbox');
        if (todoItem.classList.contains('completed')) {
            checkbox.classList.add('completed');
        }
        checkbox.addEventListener('click', async () => {
            const wasCompleted = todoItem.classList.contains('completed');
            todoItem.classList.toggle('completed');
            checkbox.classList.toggle('completed');

            if (!wasCompleted) {
                todoItem.dataset.completedAt = new Date().toISOString();
                showCompletionAnimation(todoItem);
                saveCompletionDate();
                showToast('Úkol dokončen!');
            } else {
                todoItem.dataset.completedAt = '';
            }

            await pb.collection('todos').update(todoItem.dataset.id, {
                completed: todoItem.classList.contains('completed'),
                completedAt: todoItem.dataset.completedAt || null
            });

            filterTodos(currentFilter);
        });

        todoItem.insertBefore(checkbox, todoItem.firstChild);
        addDragAndDrop(todoItem);

        // Aktualizace action tlačítek
        updateTodoActions(todoItem);

        await pb.collection('todos').update(todoItem.dataset.id, {
            deleted: false,
            deletedAt: null
        });

        filterTodos(currentFilter);
        showToast('Úkol byl obnoven');
    }

    /**
     * Trvale smaže úkol
     */
    async function permanentDeleteTodo(todoItem) {
        if (confirm('Opravdu chcete trvale smazat tento úkol? Tato akce je nevratná.')) {
            todoItem.classList.add('removing');
            try {
                await pb.collection('todos').delete(todoItem.dataset.id);
                setTimeout(() => {
                    todoItem.remove();
                    filterTodos(currentFilter);
                    showToast('Úkol byl trvale smazán');
                }, 200);
            } catch (error) {
                console.error('Chyba při mazání úkolu z PocketBase:', error);
                showToast('Chyba při trvalém mazání úkolu', 'error');
            }
        }
    }

    /**
     * Filtruje úkoly podle stavu a vyhledávacího termínu
     */
    function filterTodos(filter) {
        currentFilter = filter;
        const allItems = todoList.querySelectorAll('.todo-box');
        const today = new Date().toISOString().split('T')[0];

        allItems.forEach(item => {
            let shouldShow = true;

            // Filtrování podle stavu
            if (filter === 'active' && (item.classList.contains('completed') || item.classList.contains('deleted'))) {
                shouldShow = false;
            } else if (filter === 'completed' && (!item.classList.contains('completed') || item.classList.contains('deleted'))) {
                shouldShow = false;
            } else if (filter === 'overdue' && (!item.dataset.dueDate || item.dataset.dueDate >= today || item.classList.contains('completed') || item.classList.contains('deleted'))) {
                shouldShow = false;
            } else if (filter === 'today' && (item.dataset.dueDate !== today || item.classList.contains('deleted'))) {
                shouldShow = false;
            } else if (filter === 'deleted' && !item.classList.contains('deleted')) {
                shouldShow = false;
            } else if (filter === 'all' && item.classList.contains('deleted')) {
                shouldShow = false;
            }

            // Filtrování podle vyhledávacího termínu
            if (shouldShow && currentSearchTerm) {
                const text = item.querySelector('.todo-text-span').textContent.toLowerCase();
                const category = getCategoryName(item.dataset.category || '').toLowerCase();
                const notes = item.dataset.notes.toLowerCase();
                const searchTerm = currentSearchTerm.toLowerCase();

                if (!text.includes(searchTerm) && !category.includes(searchTerm) && !notes.includes(searchTerm)) {
                    shouldShow = false;
                }
            }

            item.style.display = shouldShow ? 'flex' : 'none';
        });

        updateTaskSummary();
        updateStats();
    }

    /**
     * Aktualizuje statistiky
     */
    function updateStats() {
        const allItems = todoList.querySelectorAll('.todo-box:not(.deleted)');
        const completedItems = todoList.querySelectorAll('.todo-box.completed:not(.deleted)');
        const today = new Date().toISOString().split('T')[0];

        // Celkový počet úkolů
        totalTasksEl.textContent = allItems.length;

        // Úkoly dokončené dnes
        const completedToday = Array.from(completedItems).filter(item => {
            const completedDate = item.dataset.completedAt ?
                new Date(item.dataset.completedAt).toISOString().split('T')[0] :
                '';
            return completedDate === today;
        });
        completedTodayEl.textContent = completedToday.length;

        // Série dní s dokončenými úkoly
        const streak = calculateStreak();
        streakDaysEl.textContent = streak;
    }

    /**
     * Vypočítá sérii dní s dokončenými úkoly
     */
    function calculateStreak() {
        const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];
        if (completedDates.length === 0) return 0;

        const today = new Date();
        let streak = 0;
        let currentDate = new Date(today);
        currentDate.setHours(0, 0, 0, 0);

        while (true) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (completedDates.includes(dateStr)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    /**
     * Uloží datum dokončení úkolu pro statistiky
     */
    function saveCompletionDate() {
        const today = new Date().toISOString().split('T')[0];
        const completedDates = JSON.parse(localStorage.getItem('completedDates')) || [];

        if (!completedDates.includes(today)) {
            completedDates.push(today);
            localStorage.setItem('completedDates', JSON.stringify(completedDates));
        }
    }

    /**
     * Vyhledávání úkolů
     */
    function searchTodos(searchTerm) {
        currentSearchTerm = searchTerm;

        if (searchTerm.trim()) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }

        filterTodos(currentFilter);
    }

    /**
     * Přidá drag & drop funkcionalitu
     */
    function addDragAndDrop(todoItem) {
        todoItem.draggable = true;

        todoItem.addEventListener('dragstart', (e) => {
            draggedElement = todoItem;
            todoItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        todoItem.addEventListener('dragend', () => {
            todoItem.classList.remove('dragging');
            document.querySelectorAll('.todo-box').forEach(item => {
                item.classList.remove('drag-over');
            });
            draggedElement = null;
        });

        todoItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (draggedElement && draggedElement !== todoItem) {
                todoItem.classList.add('drag-over');
            }
        });

        todoItem.addEventListener('dragleave', () => {
            todoItem.classList.remove('drag-over');
        });

        todoItem.addEventListener('drop', (e) => {
            e.preventDefault();
            todoItem.classList.remove('drag-over');

            if (draggedElement && draggedElement !== todoItem) {
                const rect = todoItem.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                if (e.clientY < midpoint) {
                    todoList.insertBefore(draggedElement, todoItem);
                } else {
                    todoList.insertBefore(draggedElement, todoItem.nextSibling);
                }
                showToast('Pořadí úkolů změněno');
            }
        });
    }

    /**
     * Hromadné dokončení všech aktivních úkolů
     */
    async function bulkCompleteAll() {
        const activeItems = todoList.querySelectorAll('.todo-box:not(.completed):not(.deleted)');
        if (activeItems.length === 0) {
            showToast('Žádné aktivní úkoly k dokončení', 'warning');
            return;
        }

        if (confirm(`Opravdu chcete označit všech ${activeItems.length} úkolů jako dokončené?`)) {
            const updatePromises = Array.from(activeItems).map(item => {
                item.classList.add('completed');
                const checkbox = item.querySelector('.desktop-checkbox');
                if (checkbox) {
                    checkbox.classList.add('completed');
                }
                item.dataset.completedAt = new Date().toISOString();
                return pb.collection('todos').update(item.dataset.id, {
                    completed: true,
                    completedAt: item.dataset.completedAt
                });
            });

            try {
                await Promise.all(updatePromises);
                saveCompletionDate();
                filterTodos(currentFilter);
                showToast(`${activeItems.length} úkolů dokončeno!`);
            } catch (error) {
                console.error('Chyba při hromadném dokončování úkolů:', error);
                showToast('Chyba při dokončování úkolů', 'error');
            }
        }
    }

    /**
     * Hromadné smazání všech úkolů
     */
    async function bulkDeleteAll() {
        const visibleItems = todoList.querySelectorAll('.todo-box:not(.deleted)');
        if (visibleItems.length === 0) {
            showToast('Žádné úkoly ke smazání', 'warning');
            return;
        }

        if (confirm(`Opravdu chcete smazat všech ${visibleItems.length} úkolů? Budou přesunuty do koše.`)) {
            const updatePromises = Array.from(visibleItems).map(item => {
                item.classList.add('deleted');
                item.dataset.deletedAt = new Date().toISOString();
                updateTodoActions(item);
                const checkbox = item.querySelector('.desktop-checkbox');
                if (checkbox) checkbox.remove();
                item.draggable = false;
                return pb.collection('todos').update(item.dataset.id, {
                    deleted: true,
                    deletedAt: item.dataset.deletedAt
                });
            });

            try {
                await Promise.all(updatePromises);
                filterTodos(currentFilter);
                showToast(`${visibleItems.length} úkolů smazáno`);
            } catch (error) {
                console.error('Chyba při hromadném mazání úkolů:', error);
                showToast('Chyba při mazání úkolů', 'error');
            }
        }
    }

    /**
     * Vyčistí všechny dokončené úkoly
     */
    async function clearCompletedTasks() {
        const completedItems = todoList.querySelectorAll('.todo-box.completed:not(.deleted)');
        if (completedItems.length === 0) {
            showToast('Žádné dokončené úkoly k vyčištění', 'warning');
            return;
        }

        if (confirm(`Opravdu chcete vyčistit ${completedItems.length} dokončených úkolů?`)) {
            const updatePromises = Array.from(completedItems).map(item => {
                item.classList.add('deleted');
                item.dataset.deletedAt = new Date().toISOString();
                updateTodoActions(item);
                const checkbox = item.querySelector('.desktop-checkbox');
                if (checkbox) checkbox.remove();
                item.draggable = false;
                return pb.collection('todos').update(item.dataset.id, {
                    deleted: true,
                    deletedAt: item.dataset.deletedAt
                });
            });

            try {
                await Promise.all(updatePromises);
                filterTodos(currentFilter);
                showToast(`${completedItems.length} dokončených úkolů vyčištěno`);
            } catch (error) {
                console.error('Chyba při čištění dokončených úkolů:', error);
                showToast('Chyba při čištění dokončených úkolů', 'error');
            }
        }
    }

    // Event listenery

    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterTodos(button.dataset.filter);
        });
    });

    // Add task button
    addTaskBtn.addEventListener('click', () => {
        // Reset formuláře
        taskTextInput.value = '';
        taskCategorySelect.value = '';
        taskPrioritySelect.value = 'low';
        taskDueDateInput.value = '';
        taskNotesInput.value = '';
        taskTimeEstimateSelect.value = '';
        taskRepeatSelect.value = '';

        advancedForm.classList.add('active');
        editingTodoItem = null;
        saveBtn.textContent = '💾 Uložit úkol';
        taskTextInput.focus();
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
        const text = taskTextInput.value.trim();
        if (!text) {
            showToast('Zadejte název úkolu', 'warning');
            taskTextInput.focus();
            return;
        }

        const todoData = {
            text: text,
            category: taskCategorySelect.value,
            priority: taskPrioritySelect.value,
            dueDate: taskDueDateInput.value,
            notes: taskNotesInput.value.trim(),
            timeEstimate: taskTimeEstimateSelect.value,
            repeat: taskRepeatSelect.value,
        };

        try {
            if (editingTodoItem) {
                // Úprava existujícího úkolu
                const updatedRecord = await pb.collection('todos').update(editingTodoItem.dataset.id, todoData);
                editingTodoItem.remove();
                addTodoToDOM(updatedRecord, false);
                showToast('Úkol byl upraven');
            } else {
                // Nový úkol
                const newRecord = await pb.collection('todos').create(todoData);
                addTodoToDOM(newRecord, true);
                showToast('Úkol byl přidán');
            }

            advancedForm.classList.remove('active');
            filterTodos(currentFilter);
            editingTodoItem = null;
        } catch (error) {
            console.error('Chyba při ukládání do PocketBase:', error);
            showToast('Chyba při ukládání úkolu', 'error');
        }
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        advancedForm.classList.remove('active');
        editingTodoItem = null;
        saveBtn.textContent = '💾 Uložit úkol';
    });

    // Enter key v textovém poli
    taskTextInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveBtn.click();
        }
    });

    // Escape key pro zrušení
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && advancedForm.classList.contains('active')) {
            cancelBtn.click();
        }
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        searchTodos(e.target.value);
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchTodos('');
        searchInput.focus();
    });

    // Bulk actions
    bulkCompleteBtn.addEventListener('click', bulkCompleteAll);
    bulkDeleteBtn.addEventListener('click', bulkDeleteAll);
    clearCompletedBtn.addEventListener('click', clearCompletedTasks);

    // Kontrola notifikací pro overdue úkoly
    function checkNotifications() {
        const overdueItems = todoList.querySelectorAll('.todo-box.overdue:not(.completed):not(.deleted)');
        const badge = addTaskBtn.querySelector('.notification-badge');

        if (overdueItems.length > 0) {
            if (!badge) {
                const newBadge = document.createElement('div');
                newBadge.classList.add('notification-badge');
                newBadge.textContent = overdueItems.length;
                addTaskBtn.appendChild(newBadge);
            } else {
                badge.textContent = overdueItems.length;
            }
        } else {
            if (badge) badge.remove();
        }
    }

    // Kontrola notifikací každou minutu
    setInterval(checkNotifications, 60000);

    // Pravidelná kontrola overdue úkolů
    setInterval(checkOverdueTasks, 300000); // každých 5 minut

    /**
     * Inicializuje a přepíná téma (světlý/tmavý režim)
     */
    function initializeTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-theme', currentTheme === 'dark');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
        }
    }

    // Event listener pro přepínání tématu
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-theme');
            const newTheme = isDark ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            themeToggleBtn.innerHTML = isDark ? '☀️' : '🌙';
            showToast(`Tmavý režim ${isDark ? 'zapnut' : 'vypnut'}`);
        });
    }

    // Načtení úkolů při prvním spuštění
    loadTodos();
    checkNotifications();
    initializeTheme(); // Volání funkce pro nastavení tématu

    // Nastavení dnešního data jako výchozího pro nové úkoly
    const today = new Date().toISOString().split('T')[0];
    if (taskDueDateInput) {
        taskDueDateInput.value = today;
    }

    // Ujistíme se, že empty state je zobrazen správně na začátku
    updateTaskSummary();

    console.log('Todo aplikace je připravena k použití!');
});