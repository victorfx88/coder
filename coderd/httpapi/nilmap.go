package httpapi

import (
	"reflect"

	"golang.org/x/xerrors"
)

func InitNilCollections[T any](v T) {
	defer func() {
		recover() // Just incase, do nothing
	}()

	val := reflect.ValueOf(v)
	if val.Kind() != reflect.Ptr {
		return // Can only set pointers
	}

	val = val.Elem()
	if val.Kind() != reflect.Struct {
		return // Only supports structs
	}

	initValue(val)
}

func initValue(v reflect.Value) {
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)

		// Skip unexported fields
		if !field.CanSet() {
			continue
		}

		switch field.Kind() {
		case reflect.Map:
			if field.IsNil() {
				field.Set(reflect.MakeMap(field.Type()))
			}
		case reflect.Slice:
			if field.IsNil() {
				field.Set(reflect.MakeSlice(field.Type(), 0, 0))
			}
		case reflect.Ptr:
			if field.IsNil() && field.Type().Elem().Kind() == reflect.Struct {
				ptrToStruct := reflect.New(field.Type().Elem())
				field.Set(ptrToStruct)
			}
			if field.Type().Elem().Kind() == reflect.Struct {
				initValue(field.Elem())
			}
		case reflect.Struct:
			initValue(field)
		}
	}
}

// ContainsNilCollections is mainly used to validate InitNilCollections
func ContainsNilCollections(v any) error {
	visited := make(map[uintptr]bool)
	if hasNil, field := findNilCollections(reflect.ValueOf(v), visited); hasNil {
		ty := reflect.TypeOf(v)
		extra := ""
		if field != "" {
			extra = " in field " + field
		}
		return xerrors.Errorf("nil maps received in type %q%s", ty.String(), extra)
	}
	return nil
}

func findNilCollections(val reflect.Value, visited map[uintptr]bool) (bool, string) {
	if !val.IsValid() {
		return false, ""
	}

	// Handle pointers
	for val.Kind() == reflect.Pointer || val.Kind() == reflect.Interface {
		if val.IsNil() {
			// If someone makes a *map[string]string, this will return early.
			// That is ok, because the typegen will union the type with a null
			// based on the pointer.
			return false, ""
		}
		if val.Kind() == reflect.Interface && !val.CanAddr() {
			return false, ""
		}
		ptr := val.Pointer()
		if visited[ptr] {
			return false, "" // Prevent infinite recursion
		}
		visited[ptr] = true
		val = val.Elem()
	}

	switch val.Kind() {
	case reflect.Struct:
		for i := 0; i < val.NumField(); i++ {
			if ok, field := findNilCollections(val.Field(i), visited); ok {
				fn := val.Type().Field(i).Name
				if field != "" {
					field = fn + "." + field
				} else {
					field = fn
				}
				return true, field
			}
		}
	case reflect.Slice, reflect.Array:
		if val.IsNil() {
			return true, ""
		}
		for i := 0; i < val.Len(); i++ {
			if ok, field := findNilCollections(val.Index(i), visited); ok {
				return true, field
			}
		}
	case reflect.Map:
		if val.IsNil() {
			return true, ""
		}
	}

	return false, ""
}
