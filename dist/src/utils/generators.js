const NO_VALUE = Symbol('NO_VALUE');
export async function lastX(as) {
    let lastValue = NO_VALUE;
    for await (const a of as) {
        lastValue = a;
    }
    if (lastValue === NO_VALUE) {
        throw new Error('No items in generator');
    }
    return lastValue;
}
export async function returnValue(as) {
    let e;
    do {
        e = await as.next();
    } while (!e.done);
    return e.value;
}
// Run all generators concurrently up to a concurrency cap, yielding values as they come in
export async function* all(generators, concurrencyCap = Infinity) {
    const next = (generator) => {
        const promise = generator
            .next()
            .then((result) => result.done === true
            ? {
                done: true,
                value: result.value,
                generator,
                promise,
            }
            : {
                done: false,
                value: result.value,
                generator,
                promise,
            });
        return promise;
    };
    const waiting = [...generators];
    const promises = new Set();
    // Start initial batch up to concurrency cap
    while (promises.size < concurrencyCap && waiting.length > 0) {
        const gen = waiting.shift();
        promises.add(next(gen));
    }
    while (promises.size > 0) {
        const queued = await Promise.race(promises);
        promises.delete(queued.promise);
        if (queued.done === false) {
            promises.add(next(queued.generator));
            // TODO: Clean this up
            if (queued.value !== undefined) {
                yield queued.value;
            }
        }
        else if (waiting.length > 0) {
            // Start a new generator when one finishes
            const nextGen = waiting.shift();
            promises.add(next(nextGen));
        }
    }
}
export async function toArray(generator) {
    const result = [];
    for await (const a of generator) {
        result.push(a);
    }
    return result;
}
export async function* fromArray(values) {
    for (const value of values) {
        yield value;
    }
}
//# sourceMappingURL=generators.js.map