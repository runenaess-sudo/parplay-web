export type BasicCourseValue = {
    name: string;
    location: string;
    latitude: string;
    longitude: string;
    description: string;
};

export type BasicCourseFieldErrors = Partial<Record<"name" | "location" | "latitude" | "longitude", string>>;

export function createSingleFlight<T>(operation: () => Promise<T>) {
    let pending: Promise<T> | null = null;
    return () => {
        if (pending) return pending;
        const request = operation();
        pending = request;
        const clear = () => { if (pending === request) pending = null; };
        void request.then(clear, clear);
        return request;
    };
}

export function createStepNavigationLock() {
    let locked = false;
    return {
        acquire() {
            if (locked) return false;
            locked = true;
            return true;
        },
        release() { locked = false; },
    };
}

export class BasicCourseValidationError extends Error {
    readonly fields: BasicCourseFieldErrors;
    constructor(fields: BasicCourseFieldErrors) {
        super("Please correct the highlighted fields.");
        this.fields = fields;
    }
}

export function validateBasicCourse(value: BasicCourseValue) {
    const errors: BasicCourseFieldErrors = {};
    const latitudeText = value.latitude.trim().replace(/,/g, ".");
    const longitudeText = value.longitude.trim().replace(/,/g, ".");
    const latitude = latitudeText ? Number(latitudeText) : null;
    const longitude = longitudeText ? Number(longitudeText) : null;

    if (!value.name.trim()) errors.name = "Enter a course name.";
    if (!value.location.trim()) errors.location = "Enter a city or area.";
    if ((latitude === null) !== (longitude === null)) {
        if (latitude === null) errors.latitude = "Enter latitude when providing longitude.";
        if (longitude === null) errors.longitude = "Enter longitude when providing latitude.";
    }
    if (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) {
        errors.latitude = "Enter a latitude between -90 and 90.";
    }
    if (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) {
        errors.longitude = "Enter a longitude between -180 and 180.";
    }

    return { errors, latitude, longitude };
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const radians = (value: number) => value * Math.PI / 180;
    const latitudeDelta = radians(b.latitude - a.latitude);
    const longitudeDelta = radians(b.longitude - a.longitude);
    const h = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

type NearbyCourse = { id: string; name: string; latitude: number | null; longitude: number | null };
type BasicCoursePayload = { name: string; location: string; description: string; latitude: number | null; longitude: number | null };

export async function saveBasicCourse(input: {
    value: BasicCourseValue;
    userId: string;
    courseId: string | null;
    insertId: string;
    isAdmin: boolean;
}, deps: {
    findRetry: (id: string, userId: string) => Promise<string | null>;
    findNearby: () => Promise<NearbyCourse[]>;
    insert: (id: string, userId: string, payload: BasicCoursePayload) => Promise<string>;
    update: (id: string, payload: BasicCoursePayload) => Promise<string>;
}) {
    const { errors, latitude, longitude } = validateBasicCourse(input.value);
    if (Object.keys(errors).length) throw new BasicCourseValidationError(errors);

    const payload: BasicCoursePayload = {
        name: input.value.name.trim(),
        location: input.value.location.trim(),
        description: input.value.description.trim(),
        latitude,
        longitude,
    };

    let courseId = input.courseId;
    if (!courseId) courseId = await deps.findRetry(input.insertId, input.userId);

    if (!input.isAdmin && latitude !== null && longitude !== null) {
        const nearby = await deps.findNearby();
        const match = nearby.find(course => course.id !== courseId
            && course.latitude !== null && course.longitude !== null
            && distanceMeters({ latitude, longitude }, { latitude: course.latitude, longitude: course.longitude }) < 200);
        if (match) throw new Error(`A course already exists within 200 metres: ${match.name}. Check the location before creating another course.`);
    }

    const savedId = courseId
        ? await deps.update(courseId, payload)
        : await deps.insert(input.insertId, input.userId, payload);
    if (typeof savedId !== "string" || !savedId.trim()) throw new Error("The course save was not confirmed. Please try again.");
    return savedId;
}

export function requireConfirmedCourseId(saved: unknown, currentId: string | null) {
    if (typeof saved !== "string" || !saved.trim() || currentId !== saved) {
        throw new Error("Step 1 did not confirm a saved course.");
    }
    return saved;
}