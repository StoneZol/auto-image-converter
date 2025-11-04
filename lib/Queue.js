export class Queue {
    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    enqueue(task) {
        const node = { value: task, next: null };
        if (this.tail) {
            this.tail.next = node;
            this.tail = node;
        } else {
            this.head = node;
            this.tail = node;
        }
        this.size++;
    }

    dequeue() {
        if (!this.head) return null;
        const value = this.head.value;
        this.head = this.head.next;
        if (!this.head) {
            this.tail = null;
        }
        this.size--;
        return value;
    }
    isEmpty() {
        return this.size === 0;
    }
    peek() {
        return this.head?.value ?? null;
    }
    clear() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }
}
