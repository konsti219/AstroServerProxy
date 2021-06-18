export function timeout(ms: number, promise: Promise<unknown>) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('TIMEOUT'))
        }, ms)

        promise
            .then(value => {
                clearTimeout(timer)
                resolve(value)
            })
            .catch(reason => {
                clearTimeout(timer)
                reject(reason)
            })
    })
}

export function sleep(ms: number) {
    return new Promise<void>((res, _) => {
        setTimeout(() => res(), ms)
    })
}
