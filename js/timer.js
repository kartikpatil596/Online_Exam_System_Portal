/**
 * Client Timer display & Server-synchronization module.
 */
class ExamTimer {
    constructor(serverDeadline, onTick, onExpire) {
        this.serverDeadline = new Date(serverDeadline).getTime();
        this.onTick = onTick;
        this.onExpire = onExpire;
        this.intervalId = null;
    }

    start() {
        this.update();
        this.intervalId = setInterval(() => this.update(), 1000);
    }

    update() {
        const now = Date.now();
        const diff = this.serverDeadline - now;

        if (diff <= 0) {
            this.stop();
            if (this.onTick) this.onTick(0);
            if (this.onExpire) this.onExpire();
        } else {
            if (this.onTick) this.onTick(diff);
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    static formatTime(milliseconds) {
        if (milliseconds <= 0) return "00:00:00";
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (num) => String(num).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
}
