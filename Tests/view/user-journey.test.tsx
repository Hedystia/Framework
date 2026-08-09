/** @vitest-environment happy-dom */
/** @jsxImportSource @hedystia/view */
import {
  For,
  Match,
  memo,
  mount,
  onCleanup,
  Portal,
  Show,
  Switch,
  set,
  sig,
  val,
  watch,
} from "@hedystia/view";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type Task = {
  id: number;
  title: string;
  completed: boolean;
  priority: "low" | "high";
};

type Filter = "all" | "active" | "completed";

type Route = "tasks" | "settings";

describe("View user journey regression suite", () => {
  let root: HTMLElement;
  let mountedApp: ReturnType<typeof mount> | undefined;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById("root")!;
  });

  afterEach(() => {
    mountedApp?.dispose();
    mountedApp = undefined;
  });

  it("keeps a nested task workspace consistent through a complete user journey", () => {
    let cleanedUp = 0;
    const userName = sig("Ada Lovelace");
    const darkMode = sig(false);
    const observedFilters: Filter[] = [];

    function TasksPage(props: {
      tasks: ReturnType<typeof sig<Task[]>>;
      query: ReturnType<typeof sig<string>>;
      activeFilter: ReturnType<typeof sig<Filter>>;
      selectedTask: ReturnType<typeof sig<number | null>>;
      draft: ReturnType<typeof sig<string>>;
      nextId: { value: number };
    }) {
      const visibleTasks = memo(() => {
        const normalizedQuery = val(props.query).trim().toLowerCase();
        const filter = val(props.activeFilter);

        return val(props.tasks).filter((task) => {
          const matchesQuery =
            normalizedQuery.length === 0 || task.title.toLowerCase().includes(normalizedQuery);
          const matchesFilter =
            filter === "all" || (filter === "completed" ? task.completed : !task.completed);
          return matchesQuery && matchesFilter;
        });
      });

      const remainingCount = memo(() => val(props.tasks).filter((task) => !task.completed).length);

      const addTask = (event: MouseEvent) => {
        event.preventDefault();
        const title = val(props.draft).trim();
        if (title.length === 0) {
          return;
        }

        set(props.tasks, [
          ...val(props.tasks),
          { id: props.nextId.value++, title, completed: false, priority: "low" as const },
        ]);
        set(props.draft, "");
      };

      const toggleTask = (id: number) => {
        set(
          props.tasks,
          val(props.tasks).map((task) =>
            task.id === id ? { ...task, completed: !task.completed } : task,
          ),
        );
      };

      const removeTask = (id: number) => {
        set(
          props.tasks,
          val(props.tasks).filter((task) => task.id !== id),
        );
        set(props.selectedTask, val(props.selectedTask) === id ? null : val(props.selectedTask));
      };

      return (
        <section id="tasks-page">
          <header>
            <h1>Task workspace</h1>
            <p id="remaining-count">{() => `${val(remainingCount)} remaining`}</p>
          </header>

          <div id="task-toolbar">
            <input
              id="task-search"
              type="search"
              value={() => val(props.query)}
              placeholder="Search tasks"
              onInput={(event) => set(props.query, (event.currentTarget as HTMLInputElement).value)}
            />
            <For each={["all", "active", "completed"] as Filter[]}>
              {(filter) => (
                <button
                  type="button"
                  classList={{ selected: () => val(props.activeFilter) === filter }}
                  data-filter={filter}
                  onClick={() => {
                    set(props.activeFilter, filter);
                  }}
                >
                  {filter}
                </button>
              )}
            </For>
          </div>

          <form id="new-task-form">
            <input
              id="new-task-title"
              value={() => val(props.draft)}
              placeholder="New task"
              onInput={(event) => set(props.draft, (event.currentTarget as HTMLInputElement).value)}
            />
            <button type="submit" id="add-task" onClick={addTask}>
              Add task
            </button>
          </form>

          <Show
            when={() => val(visibleTasks).length > 0}
            fallback={<p id="empty-state">No matching tasks.</p>}
          >
            <ul id="task-list">
              <For each={() => val(visibleTasks)} key={(task) => task.id}>
                {(task, index) => (
                  <li data-task-id={task.id} classList={{ completed: () => task.completed }}>
                    <span class="task-position">{() => index + 1}</span>
                    <span class="task-title">{task.title}</span>
                    <span class="task-priority">{task.priority}</span>
                    <button
                      type="button"
                      class="toggle-task"
                      data-task-id={task.id}
                      onClick={() => toggleTask(task.id)}
                    >
                      {() => (task.completed ? "Restore" : "Complete")}
                    </button>
                    <button
                      type="button"
                      class="inspect-task"
                      data-task-id={task.id}
                      onClick={() => set(props.selectedTask, task.id)}
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      class="remove-task"
                      data-task-id={task.id}
                      onClick={() => removeTask(task.id)}
                    >
                      Remove
                    </button>
                    <Show when={() => val(props.selectedTask) === task.id}>
                      <span class="task-selection">Selected</span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      );
    }

    function SettingsPage(props: { route: ReturnType<typeof sig<Route>> }) {
      const showHelp = sig(false);

      return (
        <section id="settings-page">
          <h1>Settings</h1>
          <p id="settings-user">{() => val(userName)}</p>
          <button type="button" id="toggle-theme" onClick={() => set(darkMode, !val(darkMode))}>
            Toggle theme
          </button>
          <button type="button" id="toggle-help" onClick={() => set(showHelp, !val(showHelp))}>
            Help
          </button>
          <Show when={() => val(showHelp)}>
            <p id="settings-help">Theme changes apply immediately.</p>
          </Show>
          <button type="button" id="back-to-tasks" onClick={() => set(props.route, "tasks")}>
            Back to tasks
          </button>
        </section>
      );
    }

    function App() {
      const route = sig<Route>("tasks");
      const query = sig("");
      const draft = sig("");
      const activeFilter = sig<Filter>("all");
      const selectedTask = sig<number | null>(null);
      const tasks = sig<Task[]>([
        { id: 1, title: "Design the dashboard", completed: false, priority: "high" },
        { id: 2, title: "Write regression tests", completed: true, priority: "high" },
        { id: 3, title: "Review pull request", completed: false, priority: "low" },
      ]);
      const nextId = { value: 4 };

      watch(activeFilter, (filter, previousFilter) => {
        if (filter !== previousFilter) {
          observedFilters.push(filter);
        }
      });
      onCleanup(() => {
        cleanedUp++;
      });

      return (
        <div
          id="workspace"
          classList={{
            "dark-mode": () => val(darkMode),
          }}
        >
          <nav>
            <button type="button" id="go-tasks" onClick={() => set(route, "tasks")}>
              Tasks
            </button>
            <button type="button" id="go-settings" onClick={() => set(route, "settings")}>
              Settings
            </button>
          </nav>
          <main>
            <Switch fallback={<p id="unknown-route">Unknown route</p>}>
              <Match when={() => val(route) === "tasks"}>
                {() => (
                  <TasksPage
                    tasks={tasks}
                    query={query}
                    activeFilter={activeFilter}
                    selectedTask={selectedTask}
                    draft={draft}
                    nextId={nextId}
                  />
                )}
              </Match>
              <Match when={() => val(route) === "settings"}>
                {() => <SettingsPage route={route} />}
              </Match>
            </Switch>
          </main>
          <Show when={() => val(selectedTask) !== null}>
            {() => (
              <Portal>
                <div id="task-inspector">
                  <strong>Task inspector</strong>
                  <span id="inspected-task">{() => String(val(selectedTask))}</span>
                  <button
                    type="button"
                    id="close-inspector"
                    onClick={() => set(selectedTask, null)}
                  >
                    Close
                  </button>
                </div>
              </Portal>
            )}
          </Show>
        </div>
      );
    }

    mountedApp = mount(App, root);

    expect(root.querySelector("#tasks-page")).not.toBeNull();
    expect(root.querySelector("#task-list")?.children.length).toBe(3);
    expect(root.querySelector("#remaining-count")?.textContent).toBe("2 remaining");
    expect(root.querySelector("#empty-state")).toBeNull();

    const search = root.querySelector("#task-search") as HTMLInputElement;
    search.value = "dashboard";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelector("#task-list")?.children.length).toBe(1);
    expect(root.querySelector(".task-title")?.textContent).toBe("Design the dashboard");

    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    (root.querySelector('[data-filter="active"]') as HTMLElement).click();
    expect(root.querySelector("#task-list")?.children.length).toBe(2);
    expect(root.querySelector('[data-filter="active"]')?.classList.contains("selected")).toBe(true);
    expect(observedFilters).toEqual(["active"]);

    const firstTask = root.querySelector('[data-task-id="1"]') as HTMLElement;
    (firstTask.querySelector(".toggle-task") as HTMLElement).click();
    expect(root.querySelector("#remaining-count")?.textContent).toBe("1 remaining");
    expect(root.querySelector('[data-task-id="1"]')).toBeNull();
    expect(root.querySelector('[data-task-id="3"]')).not.toBeNull();
    expect(root.querySelector('[data-filter="active"]')?.classList.contains("selected")).toBe(true);
    expect(root.querySelector("#empty-state")).toBeNull();

    (root.querySelector('[data-filter="completed"]') as HTMLElement).click();
    expect(root.querySelector("#task-list")?.children.length).toBe(2);
    expect(root.querySelectorAll(".task-position")[0]?.textContent).toBe("1");
    expect(root.querySelector('[data-task-id="1"] .toggle-task')?.textContent).toBe("Restore");

    const inspected = root.querySelector('[data-task-id="1"] .inspect-task') as HTMLElement;
    inspected.click();
    expect(root.querySelector('[data-task-id="1"] .task-selection')?.textContent).toBe("Selected");
    expect(document.body.querySelector("#task-inspector")).not.toBeNull();
    expect(document.body.querySelector("#inspected-task")?.textContent).toBe("1");
    (document.body.querySelector("#close-inspector") as HTMLElement).click();
    expect(document.body.querySelector("#task-inspector")).toBeNull();

    const newTaskInput = root.querySelector("#new-task-title") as HTMLInputElement;
    newTaskInput.value = "Ship the release";
    newTaskInput.dispatchEvent(new Event("input", { bubbles: true }));
    (root.querySelector("#add-task") as HTMLElement).click();
    (root.querySelector('[data-filter="all"]') as HTMLElement).click();
    expect(root.querySelector("#task-list")?.children.length).toBe(4);
    expect(root.querySelector("#task-list")?.textContent).toContain("Ship the release");
    (root.querySelector('[data-task-id="2"] .remove-task') as HTMLElement).click();
    expect(root.querySelector('[data-task-id="2"]')).toBeNull();
    expect(root.querySelector("#task-list")?.children.length).toBe(3);

    (root.querySelector("#go-settings") as HTMLElement).click();
    expect(root.querySelector("#settings-page")).not.toBeNull();
    expect(root.querySelector("#tasks-page")).toBeNull();
    expect(root.querySelector("#settings-user")?.textContent).toBe("Ada Lovelace");

    (root.querySelector("#toggle-theme") as HTMLElement).click();
    expect(root.querySelector("#workspace")?.classList.contains("dark-mode")).toBe(true);
    (root.querySelector("#toggle-help") as HTMLElement).click();
    expect(root.querySelector("#settings-help")).not.toBeNull();

    (root.querySelector("#back-to-tasks") as HTMLElement).click();
    expect(root.querySelector("#tasks-page")).not.toBeNull();
    expect(root.querySelector("#settings-page")).toBeNull();

    mountedApp?.dispose();
    mountedApp = undefined;
    expect(root.innerHTML).toBe("");
    expect(cleanedUp).toBe(1);
  });

  it("preserves empty states across sequential data changes", () => {
    const items = sig<Task[]>([
      { id: 10, title: "First", completed: false, priority: "low" },
      { id: 11, title: "Second", completed: false, priority: "high" },
    ]);
    const query = sig("");
    const showDetails = sig(false);

    function App() {
      const visibleItems = memo(() =>
        val(items).filter((item) => item.title.toLowerCase().includes(val(query).toLowerCase())),
      );

      return (
        <div>
          <input
            id="rapid-query"
            onInput={(event) => set(query, (event.currentTarget as HTMLInputElement).value)}
          />
          <button
            type="button"
            id="show-details"
            onClick={() => set(showDetails, !val(showDetails))}
          >
            Toggle details
          </button>
          <Show when={() => val(showDetails)} fallback={<p id="details-hidden">Details hidden</p>}>
            <Show
              when={() => val(visibleItems).length > 0}
              fallback={<p id="no-results">No results</p>}
            >
              <For each={() => val(visibleItems)}>
                {(item) => <p class="rapid-item">{item.title}</p>}
              </For>
            </Show>
          </Show>
        </div>
      );
    }

    mountedApp = mount(App, root);
    expect(root.querySelector("#details-hidden")).not.toBeNull();

    (root.querySelector("#show-details") as HTMLElement).click();
    expect(root.querySelectorAll(".rapid-item").length).toBe(2);

    const input = root.querySelector("#rapid-query") as HTMLInputElement;
    input.value = "missing";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelector("#no-results")).not.toBeNull();
    expect(root.querySelectorAll(".rapid-item").length).toBe(0);

    input.value = "first";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelectorAll(".rapid-item").length).toBe(1);
    expect(root.querySelector(".rapid-item")?.textContent).toBe("First");

    set(items, []);
    expect(root.querySelector("#no-results")).not.toBeNull();

    mountedApp?.dispose();
    mountedApp = undefined;
  });
});
