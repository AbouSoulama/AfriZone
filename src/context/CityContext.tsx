/** Compat : réexporte CountryContext (anciennes imports CityContext) */
export {
  CountryProvider as CityProvider,
  useCountry,
  useCity,
} from './CountryContext';
