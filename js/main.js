const velocity = 2;
const fps = 30;
let highScore = 0;
let score = 0;
let paused = false;
let gameStarted = false;
let enemies = [];
let enemyCount = 0;
let foods = [];
let foodCount = 0;
let rights = [];
let rightCount = 0;
const gameControlBtn = document.querySelector('.info .game-control');
const startModal = document.querySelector('.modals .modal.start-modal');
const startModalPlayBtn = startModal.querySelector('.modal-btn.modal-btn-primary');
const replayModal = document.querySelector('.modals .modal.replay-modal');
const replayModalPlayBtn = replayModal.querySelector('.modal-btn.modal-btn-primary');
const screenSizeModal = document.querySelector('.modals .modal.screen-size-modal');
const alertCurtain = document.querySelector('.alert-curtain');
const infoElem = document.querySelector('.container .info');
const rightElems = infoElem.querySelectorAll('.rights .right');
const scoreElem = infoElem.querySelector('.score .score-text');
const highScoreElem = infoElem.querySelector('.score .high-score');
const hungerBar = infoElem.querySelector('.hunger .hunger-bar');
const hungerBarPercent = infoElem.querySelector('.hunger .percent');
const sky = document.querySelector('.container .sky');
const pebbles = document.querySelector('.container .floor .dirt .pebbles');
const keys = {
    [87]: 'jump', // W
    [65]: 'goBack', // A
    [83]: 'beShort', // S
    [68]: 'goForward', // D

    [38]: 'jump', // ArrowUp
    [37]: 'goBack', // ArrowLeft
    [40]: 'beShort', // ArrowDown
    [39]: 'goForward', // ArrowRight

    [32]: 'jump', // Space
    [16]: 'beShort', // Shift
};

function updateScore(amount) {
    score += amount;
    scoreElem.innerText = Math.round(score);
}

function parseDuration(duration) {
    let type;
    let time = parseFloat(duration.match(/\d*\.*\d+/)[0]);
    let timeAsMS = time;
    if (duration.endsWith('ms')) type = 'ms';
    else if (duration.match(/\d*\.*\ds+/)) {
        type = 's';
        timeAsMS *= 1000;
    } else if (duration.match(/\d+s/)) {
        type = 's';
        timeAsMS *= 1000;
    }

    return {
        time, type, timeAsMS
    }
}

function parsePixel(pixel) {
    return parseFloat(pixel.match(/\d+\.*\d*/));
}

class Slime {
    constructor(elemQuery, velocity, jumpLimit = 200, rights = 3, hungerPercent = 100, hungerInterval = 600) {
        this.elem = document.querySelector(elemQuery);
        this.velocity = velocity;
        this.jumpLimit = jumpLimit;
        this.rights = rights;
        this.hungerPercent = hungerPercent;
        this.hungerInterval = hungerInterval;
        this.hungerBar = hungerBar;
        this.hungerBarPercent = hungerBarPercent;
        this.gameOver = false;
        this.jumping = false;
        this.doubleJumping = false;
        this.jumpForce = 0;
        this.doubleJumpForce = 0;
        this.jumpStarted = false;
        this.doubleJumpStarted = false;
        this.lastAlertUpdatePercent = null;
        setTimeout(() => this.decreaseHunger(1), 1000);
    }

    #flashAlertCurtain() {
        alertCurtain.classList.add('flash');
        let animationDuration = parseDuration(getComputedStyle(alertCurtain).animationDuration).timeAsMS;
        setTimeout(() => alertCurtain.classList.remove('flash'), animationDuration);
    }

    #drawRights() {
        if (this.rights > 3) this.rights = 3;
        let index = this.rights - 1;
        rightElems.forEach((r, i) => (i <= index ? r.classList.remove('out') : r.classList.add('out')));
    }

    #gameOver() {
        gameControlBtn.classList.add('hidden');
        this.gameOver = true;
        this.#flashAlertCurtain();
        this.#updateHungerBar(1);
        this.goBack(1);
        this.goForward(1);
        this.beShort(1);
        startModal.classList.remove('show');
        replayModal.classList.add('show');
    }

    #updateHungerBar(finish = 0) {
        if (paused) return;

        if (!finish) {
            if (this.hungerPercent <= 20 && this.lastAlertUpdatePercent !== 20) {
                this.hungerBar.parentElement.classList.add('alert');
                this.lastAlertUpdatePercent = 20;
            }

            if (this.hungerPercent > 20) {
                this.hungerBar.parentElement.classList.remove('alert');
                this.lastAlertUpdatePercent = 0;
            }

            if (this.hungerPercent <= 0) {
                this.hungerBar.parentElement.classList.add('game-over');
                this.hungerBar.parentElement.classList.remove('alert');
            }

            if (this.hungerPercent > 0) {
                this.hungerBar.parentElement.classList.remove('game-over');
            }

            this.hungerBar.style.width = this.hungerPercent + '%';

            if (this.hungerPercent <= 45) this.hungerBar.querySelector('.fill').innerText = '';
            else this.hungerBar.querySelector('.fill').innerText = this.hungerPercent + '%';

            this.hungerBarPercent.innerText = this.hungerPercent + '%';
        } else {
            clearInterval(this.decreaseHungerInterval);
        }
    }

    getDistanceFromLeft() {
        return this.elem.getBoundingClientRect().left;
    }

    addClass(...classNames) {
        return this.elem.classList.add(...classNames);
    }

    removeClass(...classNames) {
        return this.elem.classList.remove(...classNames);
    }

    increaseHunger(amount = 10) {
        if (paused) return;

        this.hungerPercent += amount;
        if (this.hungerPercent > 100) this.hungerPercent = 100;
        this.#updateHungerBar();
    }

    decreaseHunger(amount = 1) {
        if (paused) return;

        this.#updateHungerBar();
        this.decreaseHungerInterval = setInterval(() => {
            if (paused) return;
            this.hungerPercent -= amount;
            if (this.hungerPercent <= 0) {
                this.hungerPercent = 0;
                this.#updateHungerBar();
                this.#gameOver();
                clearInterval(this.decreaseHungerInterval);
                return;
            }
            this.#updateHungerBar();
        }, this.hungerInterval);
    }

    increaseRight() {
        if (paused) return;

        this.rights++;
        if (this.rights > 3) this.rights = 3;
        this.#drawRights();
    }

    decreaseRight(damage = 1) {
        if (paused) return;

        this.rights -= damage;
        this.#drawRights();
        this.#flashAlertCurtain();
        if (this.rights < 0) {
            this.#gameOver();
        }
    }

    makeAction(actionMethod, ...params) {
        if (!this.gameOver && !paused) this[actionMethod](...params);
    }

    isOnGround() {
        return parsePixel(getComputedStyle(this.elem).bottom) < 1;
    }

    jump(finish = 0) {
        if (paused) return;

        if (!finish) {
            if (this.jumping && !this.doubleJumping) return this.doubleJump();
            if (this.doubleJumping || this.jumpInterval || !this.isOnGround()) return;
            this.beShort(1);
            this.jumping = true;
            this.jumpForce = 0;
            this.jumpStarted = true;
            let distanceFromBottom = parsePixel(getComputedStyle(this.elem).bottom);
            let jumpLimit = this.jumpLimit + distanceFromBottom;

            this.jumpInterval = setInterval(() => {
                if (paused) return;
                let distanceFromBottom = parsePixel(getComputedStyle(this.elem).bottom);
                let newDistanceFromBottom = distanceFromBottom + this.velocity * 1.5 + this.jumpForce;
                let end = false;
                if (newDistanceFromBottom > jumpLimit) {
                    newDistanceFromBottom = jumpLimit;
                    end = true;
                }
                if (this.jumpStarted) {
                    this.elem.style.bottom = newDistanceFromBottom + 'px';
                    this.jumpForce += 0.01;
                }
                this.jumpStarted = newDistanceFromBottom < jumpLimit;
                if (end && !this.jumpStarted) this.jump(1);
            }, 1);
        } else {
            if (this.doubleJumpStarted || this.landingInterval || this.isOnGround()) return;
            if (!this.jumpStarted) {
                clearInterval(this.jumpInterval);
                this.jumpInterval = null;
            } else return;
            this.jumpForce = 0;
            this.landingInterval = setInterval(() => {
                if (paused) return;
                if (!this.jumpStarted) {
                    clearInterval(this.jumpInterval);
                    this.jumpInterval = null;
                }
                if (this.isOnGround()) {
                    this.jumping = false;
                    clearInterval(this.landingInterval);
                    this.landingInterval = null;
                }

                this.jumpForce += 0.05;
                let distanceFromBottom = parsePixel(getComputedStyle(this.elem).bottom);
                let newDistanceFromBottom = distanceFromBottom - this.velocity * 0.6 - this.jumpForce;
                this.elem.style.bottom = newDistanceFromBottom < 1 ? 0 : newDistanceFromBottom + 'px';
            }, 1);
        }
    }

    doubleJump(finish = 0) {
        if (paused) return;

        if (!finish) {
            if (this.doubleJumping || this.doubleJumpInterval) return;
            this.doubleJumping = true;
            this.doubleJumpForce = 0;
            this.doubleJumpStarted = true;
            this.jumping = false;
            clearInterval(this.jumpInterval);
            clearInterval(this.landingInterval);
            this.jumpInterval = null;
            this.landingInterval = null;
            let distanceFromBottom = parsePixel(getComputedStyle(this.elem).bottom);
            let jumpLimit = this.jumpLimit + distanceFromBottom;

            this.doubleJumpInterval = setInterval(() => {
                if (paused) return;
                let distanceFromBottom = parsePixel(getComputedStyle(this.elem).bottom);
                let newDistanceFromBottom = distanceFromBottom + this.velocity * 1.5 + this.doubleJumpForce;
                let end = false;
                if (newDistanceFromBottom > jumpLimit) {
                    newDistanceFromBottom = jumpLimit;
                    end = true;
                }
                if (this.doubleJumpStarted) {
                    this.elem.style.bottom = newDistanceFromBottom + 'px';
                    this.doubleJumpForce += 0.01;
                }
                this.doubleJumpStarted = newDistanceFromBottom < jumpLimit;
                if (end && !this.doubleJumpStarted) this.doubleJump(1);
            }, 1);
        } else {
            if (this.landingInterval || this.isOnGround()) return;
            if (!this.doubleJumpStarted) {
                clearInterval(this.doubleJumpInterval);
                this.doubleJumpInterval = null;
            } else {
                return;
            }
            this.doubleJumpForce = 0;
            this.landingInterval = setInterval(() => {
                if (paused) return;
                if (!this.doubleJumpStarted) {
                    clearInterval(this.doubleJumpInterval);
                    this.doubleJumpInterval = null;
                }
                if (this.isOnGround()) {
                    this.doubleJumping = false;
                    clearInterval(this.landingInterval);
                    this.landingInterval = null;
                }

                this.doubleJumpForce += 0.05;
                let distanceFromBottom = parsePixel(getComputedStyle(this.elem).bottom);
                let newDistanceFromBottom = distanceFromBottom - this.velocity * 0.6 - this.doubleJumpForce;
                this.elem.style.bottom = newDistanceFromBottom < 1 ? 0 : newDistanceFromBottom + 'px';
            }, 1);
        }
    }

    goBack(finish = 0) {
        if (paused) return this.goBack(1);

        if (!finish) {
            clearInterval(this.forwardInterval);
            this.forwardInterval = null;
            if (this.backInterval) return;

            this.backInterval = setInterval(() => {
                if (paused) return;
                if (finish) clearInterval(this.backInterval);

                let left = this.getDistanceFromLeft();
                this.elem.style.left = left - this.velocity + 'px';
                this.addClass('going-back');
                left = this.getDistanceFromLeft();
                if (left < 1) {
                    this.elem.style.left = '0px';
                    this.goBack(1);
                }
            }, 1);
        } else {
            clearInterval(this.backInterval);
            this.backInterval = null;
        }
    }

    beShort(finish = 0) {
        if (paused) return;

        if (!finish) {
            this.addClass('short');
            this.removeClass('jump');
        } else {
            this.removeClass('short');
        }
    }

    goForward(finish = 0) {
        if (paused) return this.goForward(1);

        if (!finish) {
            clearInterval(this.backInterval);
            this.backInterval = null;
            if (this.forwardInterval) return;
            this.removeClass('going-back');

            this.forwardInterval = setInterval(() => {
                if (paused) return;
                if (finish) clearInterval(this.forwardInterval);

                let left = this.getDistanceFromLeft();
                let slimeWidth = parsePixel(getComputedStyle(this.elem).width);
                this.elem.style.left = left + this.velocity + 'px';
                left = this.getDistanceFromLeft();
                if (left + slimeWidth > window.innerWidth) {
                    this.elem.style.left = window.innerWidth - slimeWidth + 'px';
                    this.goForward(1);
                }
            }, 1);
        } else {
            clearInterval(this.forwardInterval);
            this.forwardInterval = null;
        }
    }
}

class Enemy {
    constructor(type = 1) {
        this.type = type;
        this.types = {
            1: {
                class: ['enemy', 'enemy-1'],
                inner: `
                    <div class="face">
                        <div class="eyebrow"></div>
                        <div class="eye">
                            <div class="white"></div>
                        </div>
                        <div class="mouth"></div>
                    </div>
                `,
                damage: 1,
                velocity: 1.6,
            },
            2: {
                class: ['enemy', 'enemy-2'],
                inner: `
                    <div class="face">
                        <div class="eye"></div>
                    </div>
                `,
                damage: 1,
                velocity: 2,
            },
            3: {
                class: ['enemy', 'enemy-3'],
                inner: `
                    <div class="thorn thorn-top">
                        <span></span>
                        <span></span>
                    </div>
                    <div class="thorn thorn-left">
                        <span></span>
                        <span></span>
                    </div>
                    <div class="thorn thorn-right">
                        <span></span>
                        <span></span>
                    </div>
                    <div class="face">
                        <div class="eye"></div>
                    </div>
                `,
                damage: 2,
                velocity: 0.6,
            },
        }
        let selectedType = this.types[type];
        this.elem = null;
        this.velocity = selectedType.velocity;
        this.damage = selectedType.damage;
        this.generateEnemy();
    }

    getWidth() {
        return this.elem.getBoundingClientRect().width;
    }

    getHeight() {
        return this.elem.getBoundingClientRect().height;
    }

    getTop() {
        return this.elem.getBoundingClientRect().top;
    }

    getLeft() {
        return this.elem.getBoundingClientRect().left;
    }

    getBottom() {
        return window.innerHeight - (this.getTop() + this.getHeight());
    }

    getRight() {
        return window.innerWidth - this.getLeft() - this.getWidth();
    }

    generateEnemy() {
        enemyCount++;
        const enemyType = this.types[this.type];
        const enemyDiv = document.createElement('div');
        enemyDiv.classList.add(...enemyType.class);
        enemyDiv.innerHTML = enemyType.inner;
        enemyDiv.id = 'enemy-' + enemyCount;
        enemies.push(this);
        this.elem = enemyDiv;
        sky.appendChild(enemyDiv);
        this.goForward();
    }

    hide() {
        this.elem.classList.add('hide');
        let animationDuration = parseDuration(getComputedStyle(this.elem).animationDuration).timeAsMS;
        setTimeout(() => {
            this.elem.classList.add('none');
            this.elem.remove();
            enemies = enemies.filter((r) => r.elem.id !== this.elem.id);
            delete this;
        }, animationDuration);
    }

    goForward(finish = 0) {
        if (paused) return;

        if (!finish) {
            this.forwardInterval = setInterval(() => {
                if (paused) return;
                if (finish) clearInterval(this.forwardInterval);

                let left = this.getLeft();
                let enemyWidth = this.getWidth();
                this.elem.style.left = left - this.velocity + 'px';
                left = this.getLeft();
                if (left + enemyWidth < 0) this.hide();
            }, 1);
        } else {
            clearInterval(this.forwardInterval);
            this.forwardInterval = null;
        }
    }

    detectCollision(slime) {
        const enemyHeight = this.getHeight();
        const enemyWidth = this.getWidth();
        const enemyTop = this.getTop();
        const enemyLeft = this.getLeft();
        const enemyBottom = this.getBottom();
        const enemyRight = this.getRight();
        const slimeRect = slime.elem.getBoundingClientRect();
        const slimeHeight = slimeRect.height;
        const slimeWidth = slimeRect.width;
        const slimeTop = slimeRect.top;
        const slimeLeft = slimeRect.left;
        const slimeBottom = window.innerHeight - (slimeTop + slimeHeight);
        const slimeRight = window.innerWidth - slimeLeft - slimeWidth;

        if (
            ((slimeLeft <= enemyLeft + enemyWidth && slimeRight + slimeWidth <= enemyRight + enemyWidth) ||
                (slimeRight <= enemyRight + enemyWidth && slimeLeft + slimeWidth <= enemyLeft + enemyWidth) ||
                (slimeLeft + slimeWidth >= enemyLeft + enemyWidth && slimeRight + slimeWidth >= enemyRight + enemyWidth)) &&
            ((slimeBottom <= enemyBottom + enemyHeight && slimeTop + slimeHeight <= enemyTop + enemyHeight) ||
                (slimeTop <= enemyTop + enemyHeight && slimeBottom + slimeHeight <= enemyBottom + enemyHeight) ||
                (slimeTop + slimeHeight >= enemyTop + enemyHeight && slimeBottom + slimeHeight >= enemyBottom + enemyHeight))
        ) {
            if (!this.elem.classList.contains('hide')) {
                this.hide();
                this.goForward(1);
                slime.decreaseRight(this.damage);
                updateScore(-10);
            }
        }
    }
}

class Food {
    constructor(type = 1) {
        this.type = type;
        this.types = {
            1: {
                class: ['food', 'food-1'],
                inner: `
                    <div class="fill">+10%</div>
                `,
                satiety: 10,
                velocity: 0.7,
            },
            2: {
                class: ['food', 'food-2'],
                inner: `
                    <div class="fill">+20%</div>
                `,
                satiety: 20,
                velocity: 0.5,
            },
        }
        let selectedType = this.types[type];
        this.elem = null;
        this.velocity = selectedType.velocity;
        this.satiety = selectedType.satiety;
        this.generateFood();
    }

    getWidth() {
        return this.elem.getBoundingClientRect().width;
    }

    getHeight() {
        return this.elem.getBoundingClientRect().height;
    }

    getTop() {
        return this.elem.getBoundingClientRect().top;
    }

    getLeft() {
        return this.elem.getBoundingClientRect().left;
    }

    getBottom() {
        return window.innerHeight - (this.getTop() + this.getHeight());
    }

    getRight() {
        return window.innerWidth - this.getLeft() - this.getWidth();
    }

    generateFood() {
        foodCount++;
        const foodType = this.types[this.type];
        const foodDiv = document.createElement('div');
        foodDiv.classList.add(...foodType.class);
        foodDiv.innerHTML = foodType.inner;
        foodDiv.id = 'food-' + foodCount;
        foods.push(this);
        this.elem = foodDiv;
        sky.appendChild(foodDiv);
        this.goForward();
    }

    hide() {
        this.elem.classList.add('hide');
        let animationDuration = parseDuration(getComputedStyle(this.elem).animationDuration).timeAsMS;
        setTimeout(() => {
            this.elem.classList.add('none');
            this.elem.remove();
            foods = foods.filter((r) => r.elem.id !== this.elem.id);
            delete this;
        }, animationDuration);
    }

    goForward(finish = 0) {
        if (paused) return;

        if (!finish) {
            this.forwardInterval = setInterval(() => {
                if (paused) return;
                if (finish) clearInterval(this.forwardInterval);

                let left = this.getLeft();
                let foodWidth = this.getWidth();
                this.elem.style.left = left - this.velocity + 'px';
                left = this.getLeft();
                if (left + foodWidth < 0) this.hide();
            }, 1);
        } else {
            clearInterval(this.forwardInterval);
            this.forwardInterval = null;
        }
    }

    detectCollision(slime) {
        const foodHeight = this.getHeight();
        const foodWidth = this.getWidth();
        const foodTop = this.getTop();
        const foodLeft = this.getLeft();
        const foodBottom = this.getBottom();
        const foodRight = this.getRight();
        const slimeRect = slime.elem.getBoundingClientRect();
        const slimeHeight = slimeRect.height;
        const slimeWidth = slimeRect.width;
        const slimeTop = slimeRect.top;
        const slimeLeft = slimeRect.left;
        const slimeBottom = window.innerHeight - (slimeTop + slimeHeight);
        const slimeRight = window.innerWidth - slimeLeft - slimeWidth;

        if (
            ((slimeRight <= foodRight + foodWidth && slimeLeft + slimeWidth <= foodLeft + foodWidth) ||
                (slimeLeft <= foodLeft + foodWidth && slimeRight + slimeWidth <= foodRight + foodWidth) ||
                (slimeLeft + slimeWidth >= foodLeft + foodWidth && slimeRight + slimeWidth >= foodRight + foodWidth)) &&
            ((slimeBottom <= foodBottom + foodHeight && slimeTop + slimeHeight <= foodTop + foodHeight) ||
                (slimeTop <= foodTop + foodHeight && slimeBottom + slimeHeight <= foodBottom + foodHeight) ||
                (slimeTop + slimeHeight >= foodTop + foodHeight && slimeBottom + slimeHeight >= foodBottom + foodHeight))
        ) {
            if (!this.elem.classList.contains('hide')) {
                this.hide();
                this.goForward(1);
                slime.increaseHunger(this.satiety);
            }
        }
    }
}

class Right {
    constructor(velocity, type = 1) {
        this.type = type;
        this.types = {
            1: {
                class: ['right', 'right-1'],
                inner: `
                    <div class="fill">+1</div>
                `,
                velocity: 0.9,
            },
        }
        let selectedType = this.types[type];
        this.elem = null;
        this.velocity = selectedType.velocity;
        this.generateRight();
    }

    getWidth() {
        return this.elem.getBoundingClientRect().width;
    }

    getHeight() {
        return this.elem.getBoundingClientRect().height;
    }

    getTop() {
        return this.elem.getBoundingClientRect().top;
    }

    getLeft() {
        return this.elem.getBoundingClientRect().left;
    }

    getBottom() {
        return window.innerHeight - (this.getTop() + this.getHeight());
    }

    getRight() {
        return window.innerWidth - this.getLeft() - this.getWidth();
    }

    generateRight() {
        rightCount++;
        const rightType = this.types[this.type];
        const rightDiv = document.createElement('div');
        rightDiv.classList.add(...rightType.class);
        rightDiv.innerHTML = rightType.inner;
        rightDiv.id = 'right-' + rightCount;
        rights.push(this);
        this.elem = rightDiv;
        sky.appendChild(rightDiv);
        this.goForward();
    }

    hide() {
        this.elem.classList.add('hide');
        let animationDuration = parseDuration(getComputedStyle(this.elem).animationDuration).timeAsMS;
        setTimeout(() => {
            this.elem.classList.add('none');
            this.elem.remove();
            rights = rights.filter((r) => r.elem.id !== this.elem.id);
            rightCount--;
            delete this;
        }, animationDuration);
    }

    goForward(finish = 0) {
        if (paused) return;

        if (!finish) {
            this.forwardInterval = setInterval(() => {
                if (paused) return;
                if (finish) clearInterval(this.forwardInterval);

                let left = this.getLeft();
                let rightWidth = this.getWidth();
                this.elem.style.left = left - this.velocity + 'px';
                left = this.getLeft();
                if (left + rightWidth < 0) this.hide();
            }, 1);
        } else {
            clearInterval(this.forwardInterval);
            this.forwardInterval = null;
        }
    }

    detectCollision(slime) {
        const rightHeight = this.getHeight();
        const rightWidth = this.getWidth();
        const rightTop = this.getTop();
        const rightLeft = this.getLeft();
        const rightBottom = this.getBottom();
        const rightRight = this.getRight();
        const slimeRect = slime.elem.getBoundingClientRect();
        const slimeHeight = slimeRect.height;
        const slimeWidth = slimeRect.width;
        const slimeTop = slimeRect.top;
        const slimeLeft = slimeRect.left;
        const slimeBottom = window.innerHeight - (slimeTop + slimeHeight);
        const slimeRight = window.innerWidth - slimeLeft - slimeWidth;

        if (
            ((slimeRight <= rightRight + rightWidth && slimeLeft + slimeWidth <= rightLeft + rightWidth) ||
                (slimeLeft <= rightLeft + rightWidth && slimeRight + slimeWidth <= rightRight + rightWidth) ||
                (slimeLeft + slimeWidth >= rightLeft + rightWidth && slimeRight + slimeWidth >= rightRight + rightWidth)) &&
            ((slimeBottom <= rightBottom + rightHeight && slimeTop + slimeHeight <= rightTop + rightHeight) ||
                (slimeTop <= rightTop + rightHeight && slimeBottom + slimeHeight <= rightBottom + rightHeight) ||
                (slimeTop + slimeHeight >= rightTop + rightHeight && slimeBottom + slimeHeight >= rightBottom + rightHeight))
        ) {
            if (!this.elem.classList.contains('hide')) {
                this.hide();
                this.goForward(1);
                slime.increaseRight(1);
                updateScore(10);
            }
        }
    }
}

const startGame = () => {
    gameStarted = true;
    startModal.classList.remove('show');
    gameControlBtn.classList.remove('hidden');

    const slime = new Slime('.container .sky .slime', velocity, 200, 3, 100, 600);

    const enemyCreationLoop = setInterval(() => {
        if (!paused) {
            const random = Math.random() * 10;
            let type = 1;
            if (random < 2.6) type = 3;
            else if (random < 5) type = 2;

            new Enemy(type);
        }
    }, Math.max(Math.random() * 8 * 1000, Math.random() * 8 * 1000, 3000));

    const foodCreationLoop = setInterval(() => {
        if (!paused) {
            const random = Math.random() * 10;
            let type = 1;
            if (random < 3) type = 2;

            new Food(type);
        }
    }, Math.max(Math.random() * 10 * 1000, Math.random() * 10 * 1000, 5000));

    const rightCreationLoop = setInterval(() => {
        if (!paused) {
            return slime.rights < 3 ? new Right() : false;
        }
    }, Math.max(Math.random() * 10 * 1000, Math.random() * 10 * 1000, 6000));

    const gameLoop = setInterval(() => {
        if (!paused) {
            if (!pebbles.classList.contains('start')) pebbles.classList.add('start');

            if (enemyCount > 1000) enemyCount = 0;
            if (foodCount > 1000) foodCount = 0;
            if (rightCount > 1000) enemyCount = 0;

            enemies.forEach((enemy) => {
                enemy.detectCollision(slime);
                if (slime.gameOver) enemy.goForward(1);
            });

            foods.forEach((food) => {
                food.detectCollision(slime);
                if (slime.gameOver) food.goForward(1);
            });

            rights.forEach((right) => {
                right.detectCollision(slime);
                if (slime.gameOver) right.goForward(1);
            });

            if (slime.gameOver) {
                pebbles.classList.remove('start');
                clearInterval(enemyCreationLoop);
                clearInterval(foodCreationLoop);
                clearInterval(rightCreationLoop);
                clearInterval(gameLoop);

                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('highScore', score);
                    highScoreElem.innerText = Math.round(highScore);
                }
            } else {
                score += 0.2;
                scoreElem.innerText = Math.round(score);
                highScoreElem.innerText = Math.round(highScore);
            }
        } else {
            if (pebbles.classList.contains('start')) pebbles.classList.remove('start');
        }
    }, 1000 / fps);

    addEventListener('keydown', (e) => {
        if (paused || !keys[e.which]) return;

        let action = keys[e.which];
        if (action === 'beShort') slime.makeAction('beShort');
        if (action === 'jump') slime.makeAction('jump');
        if (action === 'goBack') slime.makeAction('goBack');
        if (action === 'goForward') slime.makeAction('goForward');
    });

    addEventListener('keyup', (e) => {
        if (paused || !keys[e.which]) return;

        let action = keys[e.which];
        if (action === 'beShort') slime.makeAction('beShort', 1);
        if (action === 'jump') slime.makeAction('jump', 1);
        if (action === 'goBack') slime.makeAction('goBack', 1);
        if (action === 'goForward') slime.makeAction('goForward', 1);
    });
}

const pauseGame = () => {
    if (!gameStarted) false;
    paused = !paused;
    if (paused) {
        gameControlBtn.classList.remove('hidden');
        gameControlBtn.classList.remove('pause');
        gameControlBtn.classList.add('resume');
    } else {
        gameControlBtn.classList.add('pause');
        gameControlBtn.classList.remove('resume');
    }
}

const checkWindowSize = () => {
    const available = !(window.innerWidth < 880 || window.innerHeight < 440);

    if (!available) {
        pauseGame();
        infoElem.classList.add('none');
        screenSizeModal.classList.add('show');
    } else {
        infoElem.classList.remove('none');
        screenSizeModal.classList.remove('show');
    }
}

addEventListener('load', () => {
    highScore = localStorage.getItem('highScore') || 0;
    highScoreElem.innerText = Math.round(highScore);
    checkWindowSize();
});
addEventListener('resize', () => checkWindowSize());
addEventListener('keypress', (e) => e.which === 13 ? startGame() : false);
addEventListener('keydown', (e) => e.which === 88 ? pauseGame() : false);
gameControlBtn.addEventListener('click', () => pauseGame());
startModalPlayBtn.addEventListener('click', () => startGame());
replayModalPlayBtn.addEventListener('click', () => location.reload());
